import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AVATAR_BUCKET = "avatars";

function decodeDataUrl(dataUrl: string) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error("Formato immagine non valido.");
  return { contentType: match[1]!, bytes: Buffer.from(match[2]!, "base64") };
}

/** Percorso del file nel bucket a partire dall'URL pubblico salvato nel profilo. */
function storagePath(url: string | null) {
  const marker = `/object/public/${AVATAR_BUCKET}/`;
  const i = url?.indexOf(marker) ?? -1;
  return url && i >= 0 ? url.slice(i + marker.length) : null;
}

export type AvatarResult = { ok: true; url: string | null } | { ok: false; message: string };

/**
 * Nuova foto profilo: l'AI controlla che sia adatta a ragazzi, poi il server la salva nello
 * Storage di Supabase (il browser non può scrivere nel bucket) e aggiorna il profilo.
 */
export const uploadAvatar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ photo: z.string().min(20).max(700_000) }).parse(d))
  .handler(async ({ data, context }): Promise<AvatarResult> => {
    const { contentType, bytes } = decodeDataUrl(data.photo);
    if (bytes.byteLength > 512 * 1024) return { ok: false, message: "Foto troppo grande." };

    const { checkAvatar } = await import("./vision.server");
    const check = await checkAvatar(data.photo);
    if (!check.approved) return { ok: false, message: check.message };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ext = contentType.split("/")[1] === "jpeg" ? "jpg" : contentType.split("/")[1];
    const path = `${context.userId}/${Date.now()}.${ext}`;
    const bucket = supabaseAdmin.storage.from(AVATAR_BUCKET);
    const { error: uploadError } = await bucket.upload(path, bytes, { contentType, upsert: false });
    if (uploadError) throw new Error(uploadError.message);
    const url = bucket.getPublicUrl(path).data.publicUrl;

    const { data: old } = await supabaseAdmin
      .from("profiles")
      .select("avatar_url")
      .eq("id", context.userId)
      .maybeSingle();
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ avatar_url: url })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    const oldPath = storagePath(old?.avatar_url ?? null);
    if (oldPath) await bucket.remove([oldPath]).catch(() => undefined);
    return { ok: true, url };
  });

export const removeAvatar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AvatarResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: old } = await supabaseAdmin
      .from("profiles")
      .select("avatar_url")
      .eq("id", context.userId)
      .maybeSingle();
    await supabaseAdmin.from("profiles").update({ avatar_url: null }).eq("id", context.userId);
    const oldPath = storagePath(old?.avatar_url ?? null);
    if (oldPath)
      await supabaseAdmin.storage
        .from(AVATAR_BUCKET)
        .remove([oldPath])
        .catch(() => undefined);
    return { ok: true, url: null };
  });

export type ProfileResult = { ok: true } | { ok: false; message: string };

const Nickname = z
  .string()
  .trim()
  .min(3, "Il nickname deve avere almeno 3 caratteri.")
  .max(24, "Il nickname può avere al massimo 24 caratteri.")
  .regex(/^[\p{L}\p{N}._\- ]+$/u, "Usa solo lettere, numeri, spazi, punti, trattini e _.");

/**
 * Crea il profilo con il nickname scelto: serve aver accettato termini e informativa (età
 * minima 14 anni) e il nickname passa dal controllo AI. Il browser non può crearlo da solo.
 */
export const createProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ nickname: z.string().max(100) }).parse(d))
  .handler(async ({ data, context }): Promise<ProfileResult> => {
    const parsed = Nickname.safeParse(data.nickname);
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]!.message };
    const nickname = parsed.data.replace(/\s+/g, " ");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: consent, error: consentError } = await supabaseAdmin
      .from("consents")
      .select("user_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    // (consentError = database non ancora aggiornato con la tabella dei consensi)
    if (!consent && !consentError) {
      return { ok: false, message: "Prima conferma l'età e accetta i termini." };
    }

    const { data: taken } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("nickname", nickname.replace(/[%_\\]/g, "\\$&"))
      .maybeSingle();
    if (taken) return { ok: false, message: "Nickname già in uso, scegline un altro." };

    const { checkText } = await import("./moderation.server");
    const text = await checkText("nickname", nickname);
    if (!text.ok) return text;

    const { error } = await supabaseAdmin.from("profiles").insert({ id: context.userId, nickname });
    if (error) {
      if (error.code === "23505")
        return { ok: false, message: "Nickname già in uso, scegline un altro." };
      throw new Error(error.message);
    }
    return { ok: true };
  });

/** Salva la bio dopo il controllo AI (il browser non può più scriverla direttamente). */
export const saveBio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ bio: z.string().max(2000) }).parse(d))
  .handler(async ({ data, context }): Promise<ProfileResult> => {
    const { sanitizeBio } = await import("./rules");
    const bio = sanitizeBio(data.bio);
    if (bio) {
      const { checkText } = await import("./moderation.server");
      const text = await checkText("bio", bio);
      if (!text.ok) return text;
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("profiles").update({ bio }).eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Cancella l'account e tutti i dati del giocatore (diritto alla cancellazione). Le foto profilo
 * vengono rimosse dallo Storage; i sassi già trovati da altri restano in forma anonima.
 */
export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ confirm: z.literal("ELIMINA") }).parse(d))
  .handler(async ({ context }): Promise<ProfileResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const bucket = supabaseAdmin.storage.from(AVATAR_BUCKET);
    const { data: files } = await bucket.list(context.userId);
    if (files?.length) {
      await bucket.remove(files.map((f) => `${context.userId}/${f.name}`)).catch(() => undefined);
    }
    const { error: prepError } = await supabaseAdmin.rpc("prepare_account_deletion", {
      _uid: context.userId,
    });
    if (prepError) throw new Error(prepError.message);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
