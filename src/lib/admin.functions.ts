import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: any; userId: string };

async function assertAdmin(context: Ctx) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Accesso negato: non sei un amministratore.");
}

/** Verifies the 3-step unlock sequence (server-side) for an admin account. */
export const unlockAdminPanel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { password: string }) => ({ password: String(data.password ?? "") }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { checkAdminPassword } = await import("@/lib/admin.server");
    const result = checkAdminPassword(data.password);
    if (result === "missing") {
      throw new Error("Pannello disattivato: imposta il segreto ADMIN_PANEL_PASSWORD nel Worker.");
    }
    return { ok: result === "ok" };
  });

export const adminListPlayers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as Ctx);
    const { data, error } = await context.supabase
      .from("profiles")
      .select("id,nickname,points_adjust,banned")
      .order("nickname");
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{
      id: string;
      nickname: string;
      points_adjust: number;
      banned: boolean;
    }>;
  });

export const adminListRocks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as Ctx);
    type AdminRock = {
      id: string;
      name: string;
      clue: string;
      lore: string | null;
      lat: number;
      lng: number;
      move_count: number;
    };
    const query = (cols: string) =>
      context.supabase
        .from("rocks")
        .select(cols)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
    let { data, error } = await query("id,name,clue,lore,lat,lng,move_count");
    // database senza la colonna "lore": si legge il resto
    if (error) ({ data, error } = await query("id,name,clue,lat,lng,move_count"));
    if (error) throw new Error(error.message);
    return ((data ?? []) as unknown as AdminRock[]).map((r) => ({ ...r, lore: r.lore ?? null }));
  });

/** Cestino: i sassi eliminati restano recuperabili. */
export const adminListTrash = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as Ctx);
    const { data, error } = await context.supabase
      .from("rocks")
      .select("id,name,lat,lng,deleted_at")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{
      id: string;
      name: string;
      lat: number;
      lng: number;
      deleted_at: string;
    }>;
  });

export const adminMoveRock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { rockId: string; lat: number; lng: number }) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { error } = await context.supabase
      .from("rocks")
      .update({ lat: data.lat, lng: data.lng })
      .eq("id", data.rockId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Eliminazione morbida: il sasso finisce nel cestino, i ritrovamenti restano. */
export const adminDeleteRock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { rockId: string }) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { error } = await context.supabase
      .from("rocks")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", data.rockId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminRestoreRock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { rockId: string }) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { error } = await context.supabase
      .from("rocks")
      .update({ deleted_at: null })
      .eq("id", data.rockId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Adds (or subtracts, with a negative delta) points from a player. */
export const adminAdjustPoints = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string; delta: number }) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { data: row, error: readErr } = await context.supabase
      .from("profiles")
      .select("points_adjust")
      .eq("id", data.userId)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    const next = (row?.points_adjust ?? 0) + Math.round(data.delta);
    const { error } = await context.supabase
      .from("profiles")
      .update({ points_adjust: next })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { points_adjust: next };
  });

export const adminSetBanned = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string; banned: boolean }) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    if (data.userId === context.userId) throw new Error("Non puoi bannare te stesso.");
    const { error } = await context.supabase
      .from("profiles")
      .update({ banned: data.banned })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Notifica personalizzata inviata a tutti i giocatori. */
export const adminSendAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { title: string; body: string }) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const title = data.title.trim();
    const body = data.body.trim();
    if (!title || !body) throw new Error("Titolo e messaggio sono obbligatori.");
    const { error } = await context.supabase
      .from("announcements")
      .insert({ title, body, created_by: context.userId });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminListAnnouncements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as Ctx);
    const { data, error } = await context.supabase
      .from("announcements")
      .select("id,title,body,created_at")
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{ id: string; title: string; body: string; created_at: string }>;
  });

export const adminDeleteAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { error } = await context.supabase.from("announcements").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminListDoubleDays = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as Ctx);
    const { data, error } = await context.supabase
      .from("double_days")
      .select("id,day,multiplier")
      .order("day", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{ id: string; day: string; multiplier: number }>;
  });

export const adminSetDoubleDay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { day: string; multiplier: number }) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { error } = await context.supabase
      .from("double_days")
      .upsert(
        { day: data.day, multiplier: Math.max(2, Math.round(data.multiplier)) },
        { onConflict: "day" },
      );
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminRemoveDoubleDay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { error } = await context.supabase.from("double_days").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminListRockPoints = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as Ctx);
    const { data, error } = await context.supabase
      .from("rocks")
      .select(
        "id,name,difficulty,points,points_override,rating_avg,rating_count,creator:profiles!rocks_creator_id_fkey(nickname)",
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return ((data ?? []) as any[]).map((r) => ({
      id: r.id as string,
      name: r.name as string,
      difficulty: r.difficulty as string,
      points: r.points as number,
      points_override: (r.points_override ?? null) as number | null,
      rating_avg: r.rating_avg == null ? null : Number(r.rating_avg),
      rating_count: (r.rating_count ?? 0) as number,
      creator: (r.creator?.nickname ?? "Anonimo") as string,
    }));
  });

export const adminSetRockPoints = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { rockId: string; points: number | null }) => {
    if (
      data.points !== null &&
      (!Number.isInteger(data.points) || data.points < 0 || data.points > 100000)
    )
      throw new Error("Punti non validi");
    return data;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { error } = await context.supabase
      .from("rocks")
      .update({ points_override: data.points })
      .eq("id", data.rockId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Modifica nome, indizio e storia di un sasso. */
export const adminUpdateRockText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { rockId: string; name: string; clue: string; lore: string }) => ({
    rockId: String(data.rockId),
    name: String(data.name ?? "").trim(),
    clue: String(data.clue ?? "").trim(),
    lore: String(data.lore ?? "").trim(),
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    if (data.name.length < 3 || data.name.length > 60)
      throw new Error("Nome: da 3 a 60 caratteri.");
    if (data.clue.length < 10 || data.clue.length > 800) {
      throw new Error("Indizio: da 10 a 800 caratteri.");
    }
    if (data.lore.length > 1000) throw new Error("Storia: al massimo 1000 caratteri.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("rocks")
      .update({ name: data.name, clue: data.clue, lore: data.lore || null })
      .eq("id", data.rockId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export type MissingReport = {
  id: string;
  created_at: string;
  photo: string;
  nickname: string;
};
export type MissingRock = {
  rock_id: string;
  name: string;
  clue: string;
  lat: number;
  lng: number;
  reports: MissingReport[];
};

/** Sassi con segnalazioni "non c'è" ancora aperte, con chi e quando ha segnalato. */
export const adminListMissing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MissingRock[]> => {
    await assertAdmin(context as Ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("rock_reports")
      .select("id,rock_id,user_id,photo,created_at")
      .is("resolved_at", null)
      .order("created_at");
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    if (!rows.length) return [];
    const rockIds = [...new Set(rows.map((r) => r.rock_id))];
    const userIds = [...new Set(rows.map((r) => r.user_id))];
    const [{ data: rocks }, { data: people }] = await Promise.all([
      supabaseAdmin.from("rocks").select("id,name,clue,lat,lng").in("id", rockIds),
      supabaseAdmin.from("profiles").select("id,nickname").in("id", userIds),
    ]);
    const nick = new Map((people ?? []).map((p) => [p.id, p.nickname]));
    return (rocks ?? [])
      .map((rock) => ({
        rock_id: rock.id,
        name: rock.name,
        clue: rock.clue,
        lat: rock.lat,
        lng: rock.lng,
        reports: rows
          .filter((r) => r.rock_id === rock.id)
          .map((r) => ({
            id: r.id,
            created_at: r.created_at,
            photo: r.photo,
            nickname: nick.get(r.user_id) ?? "giocatore eliminato",
          })),
      }))
      .sort((a, b) => b.reports.length - a.reports.length);
  });

/** Decisione dell'admin: togliere il sasso dalla mappa (va nel cestino) o ignorare le segnalazioni. */
export const adminResolveMissing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { rockId: string; action: "remove" | "dismiss" }) => ({
    rockId: String(data.rockId),
    action: data.action === "remove" ? ("remove" as const) : ("dismiss" as const),
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    if (data.action === "remove") {
      const { error } = await supabaseAdmin
        .from("rocks")
        .update({ deleted_at: now })
        .eq("id", data.rockId);
      if (error) throw new Error(error.message);
    }
    await supabaseAdmin
      .from("rock_reports")
      .update({ resolved_at: now, resolution: data.action === "remove" ? "removed" : "dismissed" })
      .eq("rock_id", data.rockId)
      .is("resolved_at", null);
    await supabaseAdmin
      .from("admin_notifications")
      .update({ read_at: now })
      .eq("rock_id", data.rockId)
      .is("read_at", null);
    return { ok: true as const };
  });
