export type Tier = "Facile" | "Medio" | "Difficile" | "Leggendario";

export const TIERS: Tier[] = ["Facile", "Medio", "Difficile", "Leggendario"];

export const TIER_POINTS: Record<Tier, number> = {
  Facile: 150,
  Medio: 350,
  Difficile: 650,
  Leggendario: 1000,
};

export function normalizeTier(value: string): Tier {
  if (value === "Media") return "Medio";
  return (TIERS as string[]).includes(value) ? (value as Tier) : "Facile";
}

const SIGNALS: Array<[RegExp, number]> = [
  [/\b(sotto|dentro|dietro|tra|fra|nascost[oa]|incastrat[oa]|sepolt[oa]|interrat[oa])\b/g, 1],
  [/\b(radic[ei]|cespugli?o?|siepe|muschio|foglie|tronco|cavit[aà]|buco|fessur[ae]|crepa)\b/g, 1.5],
  [/\b(bosco|foresta|sentiero|grotta|torrente|ruscello|cascata|rupe|scogli[oe]?|dirupo)\b/g, 2],
  [/\b(montagna|vetta|cima|rifugio|arrampic\w*|scal(?:a|are)|altezza|albero alto)\b/g, 2.5],
  [
    /\b(enigma|indovinell\w*|codice|coordinate|cerca(?:re)? bene|attento|difficil\w*|impossibile)\b/g,
    2,
  ],
  [/\b(panchina|fontana|piazza|ingresso|cartello|lampione|parcheggio|vicino a)\b/g, -1],
];

/** Analisi a parole chiave dell'indizio → fascia di difficoltà suggerita. */
export function suggestTier(clue: string): { tier: Tier; score: number } {
  const text = clue.toLowerCase();
  let score = 0;
  for (const [re, weight] of SIGNALS) score += (text.match(re)?.length ?? 0) * weight;
  const words = text.split(/\s+/).filter(Boolean).length;
  if (words > 25) score += 1;
  if (words > 45) score += 1;
  const tier: Tier =
    score >= 8 ? "Leggendario" : score >= 5 ? "Difficile" : score >= 2.5 ? "Medio" : "Facile";
  return { tier, score };
}
