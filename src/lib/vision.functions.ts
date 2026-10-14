import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { RockPhotoCheck } from "./vision.server";

export type PhotoVerdict = RockPhotoCheck & {
  /** Gettone firmato da passare alla conferma, presente solo se la foto è approvata. */
  token?: string;
};

const PhotoInput = z.object({
  photo: z.string().min(20).max(4_000_000), // data URL
});

/** Controlla che la foto mostri un sasso dipinto (creazione di un nuovo sasso). */
export const verifyRockPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PhotoInput.parse(input))
  .handler(async ({ data, context }): Promise<PhotoVerdict> => {
    const { checkPainted } = await import("./vision.server");
    const result = await checkPainted(data.photo);
    if (!result.approved) return result;
    const { issuePhotoToken } = await import("./photo-token.server");
    return { ...result, token: issuePhotoToken("paint", context.userId, null, data.photo) };
  });

const MatchInput = PhotoInput.extend({ rockId: z.string().uuid() });

/**
 * Confronta la foto-prova con la foto del sasso salvata sul server: deve essere lo stesso
 * sasso dipinto. La foto di riferimento non arriva mai dal browser.
 */
export const matchRockPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => MatchInput.parse(input))
  .handler(async ({ data, context }): Promise<PhotoVerdict> => {
    const { verifyRockProof } = await import("./game.server");
    const result = await verifyRockProof(data.rockId, data.photo);
    if (!result.approved) return result;
    const { issuePhotoToken } = await import("./photo-token.server");
    return { ...result, token: issuePhotoToken("match", context.userId, data.rockId, data.photo) };
  });
