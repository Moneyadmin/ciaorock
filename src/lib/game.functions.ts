import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DIFFICULTIES, FIND_RADIUS_M, HIDE_RADIUS_M, metersBetween } from "./rules";

/**
 * Le tre azioni che cambiano il gioco (nuovo sasso, ritrovamento, spostamento) passano da qui.
 * Il database non le accetta più dal browser: il server controlla foto, distanza e permessi
 * e poi scrive con la service role.
 *
 * Esito: { ok: true } oppure { ok: false, message } per un rifiuto definitivo (foto non valida,
 * troppo lontano, …). Gli errori imprevisti (rete, database) vengono invece lanciati, così la
 * coda offline sa che deve riprovare più tardi.
 */
export type GameResult = { ok: true; id?: string } | { ok: false; message: string };

const Lat = z.number().min(-90).max(90);
const Lng = z.number().min(-180).max(180);
const Photo = z.string().min(20).max(4_000_000);
const Token = z.string().max(2000).optional();

function far(meters: number) {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
}

const CreateInput = z.object({
  name: z.string().trim().min(3).max(60),
  clue: z.string().trim().min(10).max(800),
  difficulty: z.enum(DIFFICULTIES),
  photo: Photo,
  lat: Lat,
  lng: Lng,
  token: Token,
});

export const createRockFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateInput.parse(d))
  .handler(async ({ data, context }): Promise<GameResult> => {
    const { checkPhotoToken } = await import("./photo-token.server");
    if (!checkPhotoToken(data.token, "paint", context.userId, null, data.photo)) {
      const { checkPainted } = await import("./vision.server");
      const check = await checkPainted(data.photo);
      if (!check.approved) return { ok: false, message: check.message };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("rocks")
      .insert({
        name: data.name,
        clue: data.clue,
        difficulty: data.difficulty,
        photo: data.photo,
        lat: data.lat,
        lng: data.lng,
        creator_id: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id };
  });

const FindInput = z.object({
  rockId: z.string().uuid(),
  photo: Photo,
  lat: Lat,
  lng: Lng,
  token: Token,
});

export const claimFindFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => FindInput.parse(d))
  .handler(async ({ data, context }): Promise<GameResult> => {
    const { loadRock, hasFound, verifyRockProof } = await import("./game.server");
    const rock = await loadRock(data.rockId);
    if (!rock) return { ok: false, message: "Questo sasso non esiste più." };
    if (rock.creator_id === context.userId) {
      return { ok: false, message: "È un tuo sasso: lascialo trovare agli altri!" };
    }
    if (await hasFound(rock.id, context.userId)) {
      return { ok: false, message: "Hai già trovato questo sasso." };
    }
    const distance = metersBetween(data, rock);
    if (distance > FIND_RADIUS_M) {
      return {
        ok: false,
        message: `Sei a ${far(distance)} dal sasso: avvicinati a meno di ${FIND_RADIUS_M} m e riprova.`,
      };
    }
    const { checkPhotoToken } = await import("./photo-token.server");
    if (!checkPhotoToken(data.token, "match", context.userId, rock.id, data.photo)) {
      const check = await verifyRockProof(rock.id, data.photo);
      if (!check.approved) return { ok: false, message: check.message };
    }

    const { resolvePlace } = await import("./geo.server");
    const place = await resolvePlace(data.lat, data.lng).catch(() => null);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("finds").insert({
      rock_id: rock.id,
      user_id: context.userId,
      photo: data.photo,
      city: place?.city ?? null,
      region: place?.region ?? null,
      country: place?.country ?? null,
      continent: place?.continent ?? null,
    });
    if (error) {
      if (error.code === "23505") return { ok: false, message: "Hai già trovato questo sasso." };
      throw new Error(error.message);
    }
    return { ok: true };
  });

const MoveInput = z.object({
  rockId: z.string().uuid(),
  clue: z.string().trim().min(10).max(800),
  photo: Photo,
  /** nuovo nascondiglio */
  lat: Lat,
  lng: Lng,
  /** dove si trova il giocatore adesso (deve essere vicino al sasso) */
  fromLat: Lat,
  fromLng: Lng,
  token: Token,
});

export const moveRockFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => MoveInput.parse(d))
  .handler(async ({ data, context }): Promise<GameResult> => {
    const { loadRock, hasFound, verifyRockProof } = await import("./game.server");
    const rock = await loadRock(data.rockId);
    if (!rock) return { ok: false, message: "Questo sasso non esiste più." };
    if (rock.creator_id !== context.userId && !(await hasFound(rock.id, context.userId))) {
      return { ok: false, message: "Per spostare un sasso devi prima trovarlo." };
    }
    const from = { lat: data.fromLat, lng: data.fromLng };
    const pickUp = metersBetween(from, rock);
    if (pickUp > FIND_RADIUS_M) {
      return {
        ok: false,
        message: `Sei a ${far(pickUp)} dal sasso: per spostarlo devi averlo in mano (entro ${FIND_RADIUS_M} m).`,
      };
    }
    const hide = metersBetween(from, data);
    if (hide > HIDE_RADIUS_M) {
      return {
        ok: false,
        message: `Il nuovo nascondiglio è a ${far(hide)} da te: mettilo dove ti trovi (entro ${HIDE_RADIUS_M} m).`,
      };
    }
    const { checkPhotoToken } = await import("./photo-token.server");
    if (!checkPhotoToken(data.token, "match", context.userId, rock.id, data.photo)) {
      const check = await verifyRockProof(rock.id, data.photo);
      if (!check.approved) return { ok: false, message: check.message };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("rocks")
      .update({
        clue: data.clue,
        photo: data.photo,
        lat: data.lat,
        lng: data.lng,
        hidden_by: context.userId,
        move_count: rock.move_count + 1,
      })
      .eq("id", rock.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
