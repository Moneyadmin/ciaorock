import { createRock, fetchRocks } from "@/lib/api";

/** Legacy localStorage keys used before the app moved to Lovable Cloud. */
const LEGACY_KEYS = ["rockdex.db.v1", "rockdex.db.v2"];
const DONE_KEY = "rockdex.legacy-import.v2";

/** Sassi finti delle demo iniziali: non esistono nella realtà, non vanno importati. */
const DEMO_NAMES = new Set(
  ["Gufo Notturno", "Coccinella Felice", "Onda Blu", "Sole Sorridente"].map((n) => n.toLowerCase()),
);

type LegacyRock = {
  name?: unknown;
  clue?: unknown;
  photo?: unknown;
  lat?: unknown;
  lng?: unknown;
  difficulty?: unknown;
};

type LegacyRockInput = {
  name: string;
  clue: string;
  photo: string;
  lat: number;
  lng: number;
  difficulty: string;
};

function isValid(rock: LegacyRock): rock is LegacyRock & LegacyRockInput {
  return (
    typeof rock.name === "string" &&
    rock.name.trim().length > 0 &&
    typeof rock.clue === "string" &&
    typeof rock.photo === "string" &&
    rock.photo.length > 0 &&
    typeof rock.lat === "number" &&
    typeof rock.lng === "number"
  );
}

/** Rocks stored locally by previous versions of the app, deduplicated by name. */
export function readLegacyRocks(): LegacyRockInput[] {
  if (typeof window === "undefined") return [];
  const out = new Map<string, LegacyRockInput>();
  for (const key of LEGACY_KEYS) {
    let parsed: { rocks?: LegacyRock[] } | null = null;
    try {
      parsed = JSON.parse(window.localStorage.getItem(key) ?? "null");
    } catch {
      parsed = null;
    }
    for (const rock of parsed?.rocks ?? []) {
      if (!isValid(rock)) continue;
      const name = rock.name.trim();
      out.set(name.toLowerCase(), {
        name,
        clue: rock.clue.trim() || "Indizio non disponibile (sasso importato)",
        photo: rock.photo,
        lat: rock.lat,
        lng: rock.lng,
        difficulty: typeof rock.difficulty === "string" ? rock.difficulty : "Facile",
      });
    }
  }
  return [...out.values()];
}

export function legacyImportDone() {
  return typeof window !== "undefined" && window.localStorage.getItem(DONE_KEY) === "1";
}

/**
 * One-shot migration: publish the rocks saved on this device by older versions
 * to the shared backend so everyone can see them again.
 */
export async function importLegacyRocks(): Promise<number> {
  if (typeof window === "undefined" || !navigator.onLine || legacyImportDone()) return 0;
  const legacy = readLegacyRocks();
  if (legacy.length === 0) {
    window.localStorage.setItem(DONE_KEY, "1");
    return 0;
  }

  const existing = new Set((await fetchRocks()).map((r) => r.name.trim().toLowerCase()));
  let imported = 0;
  for (const rock of legacy) {
    if (existing.has(rock.name.toLowerCase())) continue;
    await createRock(rock);
    imported += 1;
  }
  window.localStorage.setItem(DONE_KEY, "1");
  return imported;
}
