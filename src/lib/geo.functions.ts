import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({ lat: z.number(), lng: z.number() });

export type PlaceResult = {
  city: string | null;
  region: string | null;
  country: string | null;
  continent: string | null;
};

export const lookupPlace = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }): Promise<PlaceResult> => {
    const { resolvePlace } = await import("./geo.server");
    return resolvePlace(data.lat, data.lng);
  });
