const CONTINENTS: Record<string, string> = {
  IT: "Europa", FR: "Europa", ES: "Europa", PT: "Europa", DE: "Europa", AT: "Europa",
  CH: "Europa", BE: "Europa", NL: "Europa", LU: "Europa", GB: "Europa", IE: "Europa",
  DK: "Europa", SE: "Europa", NO: "Europa", FI: "Europa", IS: "Europa", PL: "Europa",
  CZ: "Europa", SK: "Europa", HU: "Europa", SI: "Europa", HR: "Europa", BA: "Europa",
  RS: "Europa", ME: "Europa", MK: "Europa", AL: "Europa", GR: "Europa", BG: "Europa",
  RO: "Europa", MD: "Europa", UA: "Europa", BY: "Europa", LT: "Europa", LV: "Europa",
  EE: "Europa", RU: "Europa", MT: "Europa", CY: "Europa", SM: "Europa", VA: "Europa",
  MC: "Europa", AD: "Europa", LI: "Europa",
  US: "America del Nord", CA: "America del Nord", MX: "America del Nord",
  GT: "America del Nord", CU: "America del Nord", CR: "America del Nord",
  PA: "America del Nord", DO: "America del Nord", HN: "America del Nord",
  BR: "America del Sud", AR: "America del Sud", CL: "America del Sud", PE: "America del Sud",
  CO: "America del Sud", UY: "America del Sud", PY: "America del Sud", BO: "America del Sud",
  EC: "America del Sud", VE: "America del Sud",
  CN: "Asia", JP: "Asia", KR: "Asia", IN: "Asia", ID: "Asia", TH: "Asia", VN: "Asia",
  PH: "Asia", MY: "Asia", SG: "Asia", TR: "Asia", IL: "Asia", AE: "Asia", SA: "Asia",
  PK: "Asia", BD: "Asia", NP: "Asia", KZ: "Asia", GE: "Asia", AM: "Asia", AZ: "Asia",
  EG: "Africa", MA: "Africa", TN: "Africa", DZ: "Africa", LY: "Africa", ZA: "Africa",
  NG: "Africa", KE: "Africa", ET: "Africa", GH: "Africa", SN: "Africa", TZ: "Africa",
  AU: "Oceania", NZ: "Oceania", FJ: "Oceania", PG: "Oceania",
};

export type Place = {
  city: string | null;
  region: string | null;
  country: string | null;
  continent: string | null;
};

/** Reverse geocode a coordinate to city / region / country / continent (OpenStreetMap). */
export async function resolvePlace(lat: number, lng: number): Promise<Place> {
  const empty: Place = { city: null, region: null, country: null, continent: null };
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=12&accept-language=it`;
    const res = await fetch(url, {
      headers: { "User-Agent": "RockDex/1.0 (rock hunting app)", Accept: "application/json" },
    });
    if (!res.ok) return empty;
    const json = (await res.json()) as {
      address?: Record<string, string>;
    };
    const address = json.address ?? {};
    const city =
      address["city"] ??
      address["town"] ??
      address["village"] ??
      address["municipality"] ??
      address["county"] ??
      null;
    const region = address["state"] ?? address["region"] ?? null;
    const country = address["country"] ?? null;
    const code = (address["country_code"] ?? "").toUpperCase();
    return { city, region, country, continent: CONTINENTS[code] ?? null };
  } catch {
    return empty;
  }
}
