import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PLATE_STYLES, Plate } from "@/components/Plate";
import { SpecialBadge } from "@/components/SpecialBadge";
import {
  deleteShopItem,
  fetchRocks,
  fetchShopItems,
  saveShopItem,
  type ShopItem,
  type UnlockRule,
} from "@/lib/api";
import { UNLOCK_TYPES, describeUnlock, isAvailable, newItemId, periodLabel } from "@/lib/rewards";

type Draft = {
  id: string | null;
  kind: "plate" | "badge";
  label: string;
  icon: string;
  description: string;
  style: string;
  buyable: boolean;
  price: number;
  conditional: boolean;
  unlockType: UnlockRule["type"];
  unlockN: number;
  unlockRef: string;
  temporary: boolean;
  from: string;
  to: string;
  active: boolean;
};

const EMPTY: Draft = {
  id: null,
  kind: "badge",
  label: "",
  icon: "🏅",
  description: "",
  style: "gold",
  buyable: false,
  price: 500,
  conditional: true,
  unlockType: "finds",
  unlockN: 5,
  unlockRef: "",
  temporary: false,
  from: "",
  to: "",
  active: true,
};

/** ISO → valore per <input type="datetime-local"> nell'ora locale. */
function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromItem(item: ShopItem): Draft {
  return {
    id: item.id,
    kind: item.kind,
    label: item.label,
    icon: item.icon,
    description: item.description,
    style: item.style,
    buyable: item.price != null,
    price: item.price ?? 500,
    conditional: item.unlock != null,
    unlockType: item.unlock?.type ?? "finds",
    unlockN: item.unlock?.n ?? 5,
    unlockRef: item.unlock?.ref ?? "",
    temporary: Boolean(item.starts_at || item.ends_at),
    from: toLocalInput(item.starts_at),
    to: toLocalInput(item.ends_at),
    active: item.active,
  };
}

function status(item: ShopItem) {
  if (!item.active) return ["Disattivato", "bg-muted text-muted-foreground"] as const;
  if (isAvailable(item)) return ["Disponibile", "bg-moss/15 text-[oklch(0.45_0.12_162)]"] as const;
  if (item.starts_at && new Date(item.starts_at).getTime() > Date.now())
    return ["In arrivo", "bg-sun/30 text-ink"] as const;
  return ["Terminato", "bg-muted text-muted-foreground"] as const;
}

const field =
  "w-full rounded-2xl border border-input bg-card px-4 py-3 outline-none focus:border-ring focus:ring-4 focus:ring-ring/15";

/** Admin: crea e modifica badge e targhette, anche temporanei, a pagamento o a condizione. */
export function RewardsAdmin() {
  const queryClient = useQueryClient();
  const items = useQuery({ queryKey: ["shop-items"], queryFn: fetchShopItems });
  const rocks = useQuery({ queryKey: ["rocks"], queryFn: fetchRocks });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["shop-items"] });
    await queryClient.invalidateQueries({ queryKey: ["reward-progress"] });
  }

  function problem(d: Draft): string | null {
    if (!d.label.trim()) return "Scrivi il nome.";
    if (d.kind === "badge" && !d.icon.trim()) return "Scegli un'icona (un'emoji).";
    if (!d.buyable && !d.conditional)
      return "Scegli come si ottiene: acquisto, condizione o entrambi.";
    if (d.buyable && (!Number.isFinite(d.price) || d.price < 0)) return "Prezzo non valido.";
    if (d.conditional && (!Number.isFinite(d.unlockN) || d.unlockN < 1))
      return "Il numero deve essere almeno 1.";
    if (d.conditional && d.unlockType === "rock" && !d.unlockRef) return "Scegli il sasso.";
    if (d.conditional && d.unlockType === "city" && !d.unlockRef.trim()) return "Scrivi la città.";
    if (d.temporary && !d.from && !d.to) return "Indica almeno l'inizio o la fine del periodo.";
    if (d.temporary && d.from && d.to && new Date(d.from) >= new Date(d.to))
      return "La fine deve essere dopo l'inizio.";
    return null;
  }

  async function save() {
    if (!draft) return;
    const error = problem(draft);
    if (error) return void toast.error(error);
    setBusy(true);
    try {
      const unlock: UnlockRule | null = draft.conditional
        ? {
            type: draft.unlockType,
            n: draft.unlockType === "rock" ? 1 : Math.round(draft.unlockN),
            ...(draft.unlockType === "rock" || draft.unlockType === "city"
              ? { ref: draft.unlockRef.trim() }
              : {}),
          }
        : null;
      await saveShopItem({
        id: draft.id ?? newItemId(draft.label),
        kind: draft.kind,
        label: draft.label.trim(),
        icon: draft.icon.trim() || "🏅",
        description: draft.description.trim(),
        style: draft.style,
        price: draft.buyable ? Math.round(draft.price) : null,
        unlock,
        starts_at: draft.temporary && draft.from ? new Date(draft.from).toISOString() : null,
        ends_at: draft.temporary && draft.to ? new Date(draft.to).toISOString() : null,
        active: draft.active,
        ...(draft.id ? {} : { sort: 100 + (items.data?.length ?? 0) }),
      });
      toast.success(draft.id ? "Premio aggiornato" : "Premio creato: è già visibile ai giocatori");
      setDraft(null);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Salvataggio non riuscito");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(item: ShopItem) {
    try {
      await saveShopItem({ ...item, active: !item.active });
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Non riuscito");
    }
  }

  async function remove(item: ShopItem) {
    if (!window.confirm(`Eliminare “${item.label}”?`)) return;
    try {
      await deleteShopItem(item.id);
      toast.success("Premio eliminato");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Non riuscito");
    }
  }

  const rockName = (id?: string) => rocks.data?.find((r) => r.id === id)?.name;
  const list = items.data ?? [];

  return (
    <div className="space-y-3">
      {!draft && (
        <button
          type="button"
          onClick={() => setDraft({ ...EMPTY })}
          className="press bg-brand flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 font-extrabold text-white shadow-glow"
        >
          <Plus className="h-5 w-5" /> Nuovo badge o targhetta
        </button>
      )}

      {draft && (
        <div className="pebble-card space-y-3 p-4">
          <p className="font-bold">{draft.id ? "Modifica premio" : "Nuovo premio"}</p>

          <div className="flex rounded-2xl bg-muted p-1 text-sm font-extrabold">
            {(["badge", "plate"] as const).map((k) => (
              <button
                key={k}
                type="button"
                disabled={Boolean(draft.id)}
                onClick={() => set("kind", k)}
                className={`flex-1 rounded-xl py-2 ${
                  draft.kind === k
                    ? "bg-ink text-ink-foreground shadow-pebble"
                    : "text-muted-foreground"
                }`}
              >
                {k === "badge" ? "Badge" : "Targhetta"}
              </button>
            ))}
          </div>

          <div className="grid place-items-center rounded-2xl bg-secondary/50 p-4">
            {draft.kind === "plate" ? (
              <Plate label={draft.label || "Anteprima"} style={draft.style} size="md" />
            ) : (
              <SpecialBadge icon={draft.icon || "🏅"} label={draft.label || "Anteprima"} />
            )}
          </div>

          <div className="flex gap-2">
            {draft.kind === "badge" && (
              <input
                value={draft.icon}
                onChange={(e) => set("icon", e.target.value)}
                maxLength={16}
                aria-label="Icona (emoji)"
                className={`${field.replace("w-full", "")} w-20 shrink-0 px-2 text-center text-2xl`}
              />
            )}
            <input
              value={draft.label}
              onChange={(e) => set("label", e.target.value)}
              maxLength={40}
              placeholder="Nome (es. Cacciatore di Halloween)"
              className={field}
            />
          </div>
          <textarea
            value={draft.description}
            onChange={(e) => set("description", e.target.value)}
            maxLength={200}
            rows={2}
            placeholder="Descrizione breve (facoltativa)"
            className={field}
          />
          {draft.kind === "plate" && (
            <select
              value={draft.style}
              onChange={(e) => set("style", e.target.value)}
              className={field}
            >
              {PLATE_STYLES.map((s) => (
                <option key={s.id} value={s.id}>
                  Colore: {s.label}
                </option>
              ))}
            </select>
          )}

          <p className="pt-1 text-sm font-extrabold">Come si ottiene</p>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={draft.buyable}
              onChange={(e) => set("buyable", e.target.checked)}
              className="h-5 w-5 accent-[var(--primary)]"
            />
            Si compra nel negozio
          </label>
          {draft.buyable && (
            <input
              type="number"
              min={0}
              value={draft.price}
              onChange={(e) => set("price", Number(e.target.value))}
              aria-label="Prezzo in punti"
              className={field}
            />
          )}
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={draft.conditional}
              onChange={(e) => set("conditional", e.target.checked)}
              className="h-5 w-5 accent-[var(--primary)]"
            />
            Si sblocca gratis con una condizione
          </label>
          {draft.conditional && (
            <div className="space-y-2 rounded-2xl bg-muted/60 p-3">
              <select
                value={draft.unlockType}
                onChange={(e) => {
                  set("unlockType", e.target.value as UnlockRule["type"]);
                  set("unlockRef", "");
                }}
                className={field}
              >
                {UNLOCK_TYPES.map((u) => (
                  <option key={u.type} value={u.type}>
                    {u.label}
                  </option>
                ))}
              </select>
              {draft.unlockType !== "rock" && (
                <input
                  type="number"
                  min={1}
                  value={draft.unlockN}
                  onChange={(e) => set("unlockN", Number(e.target.value))}
                  aria-label="Quanti (N)"
                  className={field}
                />
              )}
              {draft.unlockType === "rock" && (
                <select
                  value={draft.unlockRef}
                  onChange={(e) => set("unlockRef", e.target.value)}
                  className={field}
                >
                  <option value="">Scegli il sasso…</option>
                  {(rocks.data ?? []).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              )}
              {draft.unlockType === "city" && (
                <input
                  value={draft.unlockRef}
                  onChange={(e) => set("unlockRef", e.target.value)}
                  placeholder="Città (es. Milano)"
                  className={field}
                />
              )}
              <p className="text-xs text-muted-foreground">
                {describeUnlock(
                  { type: draft.unlockType, n: draft.unlockN, ref: draft.unlockRef },
                  rockName(draft.unlockRef),
                )}
                {draft.temporary && draft.unlockType !== "streak"
                  ? ": contano solo le azioni fatte nel periodo."
                  : "."}{" "}
                Viene assegnato in automatico appena il giocatore ci arriva.
              </p>
            </div>
          )}

          <label className="flex items-center gap-2 pt-1 text-sm font-semibold">
            <input
              type="checkbox"
              checked={draft.temporary}
              onChange={(e) => set("temporary", e.target.checked)}
              className="h-5 w-5 accent-[var(--primary)]"
            />
            Temporaneo: disponibile solo in un periodo
          </label>
          {draft.temporary && (
            <div className="grid gap-2">
              <label className="text-xs font-bold text-muted-foreground">
                Dal (vuoto = da subito)
                <input
                  type="datetime-local"
                  value={draft.from}
                  onChange={(e) => set("from", e.target.value)}
                  className={`${field} mt-1`}
                />
              </label>
              <label className="text-xs font-bold text-muted-foreground">
                Al (vuoto = senza scadenza)
                <input
                  type="datetime-local"
                  value={draft.to}
                  onChange={(e) => set("to", e.target.value)}
                  className={`${field} mt-1`}
                />
              </label>
              <p className="text-xs text-muted-foreground">
                Finito il periodo sparisce dal negozio e non si sblocca più, ma chi l'ha ottenuto lo
                tiene.
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="press flex-1 rounded-2xl bg-muted py-3 text-sm font-extrabold text-muted-foreground"
            >
              Annulla
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void save()}
              className="press flex-[1.4] rounded-2xl bg-primary py-3 text-sm font-extrabold text-primary-foreground disabled:opacity-60"
            >
              {busy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Salva"}
            </button>
          </div>
        </div>
      )}

      {items.isLoading && (
        <p className="pebble-card flex items-center gap-2 p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carico i premi…
        </p>
      )}

      {list.map((item) => {
        const [label, tone] = status(item);
        const period = periodLabel(item);
        return (
          <div key={item.id} className="pebble-card space-y-2 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {item.kind === "plate" ? (
                  <Plate label={item.label} style={item.style} size="md" />
                ) : (
                  <SpecialBadge icon={item.icon} label={item.label} size="sm" />
                )}
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${tone}`}
              >
                {label}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {[
                item.kind === "plate" ? "Targhetta" : "Badge",
                item.price != null ? `${item.price.toLocaleString("it-IT")} punti` : null,
                item.unlock ? describeUnlock(item.unlock, rockName(item.unlock.ref)) : null,
                period,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDraft(fromItem(item))}
                className="press inline-flex items-center gap-1 rounded-xl bg-secondary px-3 py-2 text-xs font-extrabold text-secondary-foreground"
              >
                <Pencil className="h-3.5 w-3.5" /> Modifica
              </button>
              <button
                type="button"
                onClick={() => void toggle(item)}
                className="press rounded-xl bg-muted px-3 py-2 text-xs font-extrabold"
              >
                {item.active ? "Disattiva" : "Riattiva"}
              </button>
              <button
                type="button"
                onClick={() => void remove(item)}
                aria-label="Elimina"
                className="press ml-auto grid h-8 w-8 place-items-center rounded-xl border border-border text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
