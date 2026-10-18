import { toast } from "sonner";
import { claimRewards, type ShopItem, type UnlockRule } from "@/lib/api";

/** Condizioni di sblocco che l'admin può scegliere (le conta il database, vedi reward_progress). */
export const UNLOCK_TYPES: Array<{ type: UnlockRule["type"]; label: string; ref?: string }> = [
  { type: "finds", label: "Trova N sassi" },
  { type: "creates", label: "Crea N sassi" },
  { type: "points", label: "Guadagna N punti" },
  { type: "streak", label: "Entra N giorni di fila" },
  { type: "coop", label: "Completa N missioni co-op" },
  { type: "rock", label: "Trova un sasso preciso", ref: "Sasso" },
  { type: "city", label: "Trova N sassi in una città", ref: "Città" },
];

function plural(n: number, one: string, many: string) {
  return `${n.toLocaleString("it-IT")} ${n === 1 ? one : many}`;
}

export function describeUnlock(rule: UnlockRule, rockName?: string | null) {
  switch (rule.type) {
    case "finds":
      return `Trova ${plural(rule.n, "sasso", "sassi")}`;
    case "creates":
      return `Crea ${plural(rule.n, "sasso", "sassi")}`;
    case "points":
      return `Guadagna ${plural(rule.n, "punto", "punti")}`;
    case "streak":
      return `Entra nel gioco ${plural(rule.n, "giorno", "giorni")} di fila`;
    case "coop":
      return `Completa ${plural(rule.n, "missione co-op", "missioni co-op")}`;
    case "rock":
      return `Trova il sasso “${rockName ?? "segreto"}”`;
    case "city":
      return `Trova ${plural(rule.n, "sasso", "sassi")} a ${rule.ref ?? ""}`;
  }
}

export function isAvailable(item: ShopItem, now = Date.now()) {
  return (
    item.active &&
    (!item.starts_at || new Date(item.starts_at).getTime() <= now) &&
    (!item.ends_at || new Date(item.ends_at).getTime() > now)
  );
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("it-IT", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

/** "Fino al 31 ott, 23:59", "Dal 1 nov, 00:00" oppure null se è sempre disponibile. */
export function periodLabel(item: Pick<ShopItem, "starts_at" | "ends_at">, now = Date.now()) {
  const { starts_at: from, ends_at: to } = item;
  if (from && new Date(from).getTime() > now) {
    return to ? `Dal ${fmt(from)} al ${fmt(to)}` : `Dal ${fmt(from)}`;
  }
  if (to) return new Date(to).getTime() > now ? `Fino al ${fmt(to)}` : `Terminato il ${fmt(to)}`;
  return null;
}

/** Id leggibile e unico per un premio nuovo, es. "halloween-k3f9". */
export function newItemId(label: string) {
  const slug = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${slug || "premio"}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Chiede al database i premi appena sbloccati e li annuncia con un avviso. */
export async function announceRewards() {
  try {
    for (const r of await claimRewards()) {
      toast.success(
        `${r.icon} ${r.kind === "badge" ? "Nuovo badge" : "Nuova targhetta"}: ${r.label}!`,
        {
          id: `reward-${r.id}`,
          description:
            r.kind === "badge" ? "Lo trovi nella tua collezione." : "Indossala dal tuo profilo.",
        },
      );
    }
  } catch {
    /* non bloccante: riprova al prossimo accesso */
  }
}
