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
  .inputValidator((data: { passwordOne: string; passwordTwo: string; answer: string }) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { checkAdminSequence } = await import("@/lib/admin.server");
    if (!checkAdminSequence(data)) return { ok: false as const };
    return { ok: true as const };
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
    const { data, error } = await context.supabase
      .from("rocks")
      .select("id,name,lat,lng,move_count")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{
      id: string;
      name: string;
      lat: number;
      lng: number;
      move_count: number;
    }>;
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
