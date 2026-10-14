export type BadgeCategory = "creatore" | "trovatore" | "tempo" | "serie" | "luogo";

export type Badge = {
  id: string;
  name: string;
  icon: string;
  category: BadgeCategory;
  description: string;
};

export const CATEGORY_LABELS: Record<BadgeCategory, string> = {
  creatore: "Creatore di sassi",
  trovatore: "Trovatore di sassi",
  tempo: "Tempo",
  serie: "Serie",
  luogo: "Luogo",
};

const CREATE_TIERS: Array<[string, string, number, string]> = [
  ["creativo", "CREATIVO", 1, "🎨"],
  ["disegnatore", "DISEGNATORE", 10, "✏️"],
  ["illustratore", "ILLUSTRATORE", 50, "🖌️"],
  ["pittore", "PITTORE", 100, "🖼️"],
  ["sassomane", "SASSOMANE", 1000, "🪨"],
  ["create-2317", "23:17", 2317, "🌙"],
];

const FIND_TIERS: Array<[string, string, number, string]> = [
  ["beginner", "BEGINNER", 1, "🥉"],
  ["bravo", "GIOCATORE BRAVO", 5, "🥈"],
  ["molto-bravo", "GIOCATORE MOLTO BRAVO", 10, "🥇"],
  ["geocashingaro", "GEOCASHINGARO", 25, "🧭"],
  ["esploratore", "ESPLORATORE", 50, "🗺️"],
  ["esperto", "GIOCATORE ESPERTO", 100, "🏅"],
  ["cercatore-tesori", "CERCATORE DI TESORI", 250, "💎"],
  ["master", "GIOCATORE MASTER", 500, "👑"],
  ["indiana", "INDIANA JONES", 1000, "🤠"],
  ["semidio", "SEMIDIO DEI SASSI", 5000, "⚡"],
  ["dio", "DIO DEI SASSI", 10000, "🌟"],
];

const HOUR_NAMES = [
  "CUORE DELLA NOTTE",
  "L'UNA",
  "LE DUE",
  "LE TRE",
  "LE QUATTRO",
  "LE CINQUE",
  "LE SEI",
  "LE SETTE",
  "LE OTTO",
  "LE NOVE",
  "LE DIECI",
  "LE UNDICI",
  "LE DODICI",
];

const MINUTE_BADGES: Array<[string, number, number]> = [
  ["12:34", 12, 34],
  ["23:17", 23, 17],
  ["11:11", 11, 11],
  ["22:22", 22, 22],
];

const STREAK_TIERS: Array<[string, string, number, string]> = [
  ["terzina", "TERZINA", 3, "3️⃣"],
  ["cinquina", "CINQUINA", 5, "5️⃣"],
  ["settimanale", "SETTIMANALE", 7, "📅"],
  ["mensile", "MENSILE", 30, "🗓️"],
];

const PLACE_TIERS: Array<[string, string, "city" | "region" | "country" | "continent", number, string]> = [
  ["cittadino-1", "CITTADINO 1", "city", 5, "🏘️"],
  ["cittadino-2", "CITTADINO 2", "city", 10, "🏙️"],
  ["cittadino-3", "CITTADINO 3", "city", 25, "🌆"],
  ["cittadino-4", "CITTADINO 4", "city", 50, "🌃"],
  ["regionale-1", "REGIONALE 1", "region", 25, "🚩"],
  ["regionale-2", "REGIONALE 2", "region", 50, "🏞️"],
  ["regionale-3", "REGIONALE 3", "region", 100, "⛰️"],
  ["regionale-4", "REGIONALE 4", "region", 500, "🏔️"],
  ["nazionale-1", "NAZIONALE 1", "country", 100, "🇮🇹"],
  ["nazionale-2", "NAZIONALE 2", "country", 250, "🏛️"],
  ["nazionale-3", "NAZIONALE 3", "country", 500, "🎖️"],
  ["continentale-1", "CONTINENTALE 1", "continent", 500, "🌍"],
  ["continentale-2", "CONTINENTALE 2", "continent", 1000, "🌐"],
];

const PLACE_LABEL: Record<"city" | "region" | "country" | "continent", string> = {
  city: "città",
  region: "regione",
  country: "nazione",
  continent: "continente",
};

export const BADGES: Badge[] = [
  ...CREATE_TIERS.map(([id, name, n, icon]) => ({
    id,
    name,
    icon,
    category: "creatore" as const,
    description: `Crea ${n.toLocaleString("it-IT")} ${n === 1 ? "sasso" : "sassi"}`,
  })),
  ...FIND_TIERS.map(([id, name, n, icon]) => ({
    id,
    name,
    icon,
    category: "trovatore" as const,
    description: `Trova ${n.toLocaleString("it-IT")} ${n === 1 ? "sasso" : "sassi"}`,
  })),
  ...HOUR_NAMES.map((name, hour) => ({
    id: `ora-${hour}`,
    name,
    icon: "⏰",
    category: "tempo" as const,
    description: `Trova un sasso alle ${hour}:00`,
  })),
  {
    id: "mattinata",
    name: "MATTINATA",
    icon: "🌅",
    category: "tempo",
    description: "Trova un sasso tra le 00:00 e le 12:00",
  },
  {
    id: "serata",
    name: "SERATA",
    icon: "🌇",
    category: "tempo",
    description: "Trova un sasso tra le 12:00 e le 00:00",
  },
  ...MINUTE_BADGES.map(([name, h, m]) => ({
    id: `minuto-${h}-${m}`,
    name,
    icon: "🕰️",
    category: "tempo" as const,
    description: `Trova un sasso alle ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
  })),
  ...STREAK_TIERS.map(([id, name, n, icon]) => ({
    id,
    name,
    icon,
    category: "serie" as const,
    description: `Entra nel gioco ${n} giorni di fila`,
  })),
  ...PLACE_TIERS.map(([id, name, scope, n, icon]) => ({
    id,
    name,
    icon,
    category: "luogo" as const,
    description: `Trova ${n.toLocaleString("it-IT")} sassi nello stesso/nella stessa ${PLACE_LABEL[scope]}`,
  })),
];

export type FindRecord = {
  found_at: string;
  city: string | null;
  region: string | null;
  country: string | null;
  continent: string | null;
};

export type BadgeStats = {
  created: number;
  found: number;
  finds: FindRecord[];
  streak: number;
};

function maxByKey(finds: FindRecord[], key: keyof FindRecord) {
  const counts = new Map<string, number>();
  for (const find of finds) {
    const value = find[key];
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  let max = 0;
  counts.forEach((n) => {
    if (n > max) max = n;
  });
  return max;
}

export function earnedBadgeIds(stats: BadgeStats): string[] {
  const earned: string[] = [];

  for (const [id, , n] of CREATE_TIERS) if (stats.created >= n) earned.push(id);
  for (const [id, , n] of FIND_TIERS) if (stats.found >= n) earned.push(id);
  for (const [id, , n] of STREAK_TIERS) if (stats.streak >= n) earned.push(id);

  const times = stats.finds.map((f) => new Date(f.found_at));
  for (let hour = 0; hour <= 12; hour += 1) {
    if (times.some((d) => d.getHours() === hour && d.getMinutes() === 0)) earned.push(`ora-${hour}`);
  }
  if (times.some((d) => d.getHours() < 12)) earned.push("mattinata");
  if (times.some((d) => d.getHours() >= 12)) earned.push("serata");
  for (const [, h, m] of MINUTE_BADGES) {
    if (times.some((d) => d.getHours() === h && d.getMinutes() === m)) earned.push(`minuto-${h}-${m}`);
  }

  const maxima = {
    city: maxByKey(stats.finds, "city"),
    region: maxByKey(stats.finds, "region"),
    country: maxByKey(stats.finds, "country"),
    continent: maxByKey(stats.finds, "continent"),
  };
  for (const [id, , scope, n] of PLACE_TIERS) if (maxima[scope] >= n) earned.push(id);

  return earned;
}
