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
