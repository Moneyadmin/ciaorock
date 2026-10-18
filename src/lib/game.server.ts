import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { checkPainted, checkSameRock, type RockPhotoCheck } from "./vision.server";

/** Sasso visto dal server, con la foto di riferimento. null se non esiste o è nel cestino. */
export async function loadRock(rockId: string) {
  const { data, error } = await supabaseAdmin
    .from("rocks")
    .select("id,name,clue,creator_id,lat,lng,photo,move_count,deleted_at")
    .eq("id", rockId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.deleted_at) return null;
  return data;
}

export async function hasFound(rockId: string, userId: string) {
  const { count, error } = await supabaseAdmin
    .from("finds")
    .select("id", { count: "exact", head: true })
    .eq("rock_id", rockId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

/** Foto-prova confrontata con la foto del sasso salvata sul server. */
export async function verifyRockProof(rockId: string, photo: string): Promise<RockPhotoCheck> {
  const rock = await loadRock(rockId);
  if (!rock) return { approved: false, message: "Questo sasso non esiste più." };
  return rock.photo ? checkSameRock(photo, rock.photo) : checkPainted(photo);
}
