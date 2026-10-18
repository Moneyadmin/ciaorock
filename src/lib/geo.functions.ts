import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });

export type PlaceResult = {
  city: string | null;
  region: string | null;
  country: string | null;
  continent: string | null;
};

/** Solo per utenti con accesso: altrimenti chiunque potrebbe usarci come servizio di geocodifica. */
export const lookupPlace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }): Promise<PlaceResult> => {
    const { resolvePlace } = await import("./geo.server");
    return resolvePlace(data.lat, data.lng);
  });
