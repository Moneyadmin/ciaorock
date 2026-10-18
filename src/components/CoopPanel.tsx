import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Check, Clock, Loader2, PartyPopper, Swords, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  coopCancel,
  coopRespond,
  fetchMyMissions,
  fetchProfileById,
  type CoopMission,
} from "@/lib/api";

const SEEN_KEY = "ciaorock.coop-seen";

function readSeen(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function markSeen(id: string) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...readSeen().slice(-20), id]));
  } catch {
    /* storage non disponibile: l'esito ricomparirà, nessun problema */
  }
}

/** Missioni dell'utente, aggiornate in tempo reale dal database (tabella coop_missions). */
export function useCoopMissions(userId: string | null) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["coop", userId],
    queryFn: () => fetchMyMissions(userId!),
    enabled: Boolean(userId),
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`coop-${userId}-${Date.now()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "coop_missions" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["coop", userId] });
        void queryClient.invalidateQueries({ queryKey: ["wallet", userId] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  return query.data ?? [];
}

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

function clock(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Riquadri della missione co-op mostrati sopra la mappa. */
export function CoopPanel({
  userId,
  missions,
  onGoToRock,
}: {
  userId: string;
  missions: CoopMission[];
  onGoToRock: (rockId: string) => void;
}) {
  const queryClient = useQueryClient();
  const [seen, setSeen] = useState<string[]>(() =>
    typeof window === "undefined" ? [] : readSeen(),
  );
  const [busy, setBusy] = useState(false);
  const live = missions.filter((m) => m.status === "pending" || m.status === "active");
  const now = useNow(live.length > 0);

  const visible = missions.filter((m) => {
    if (m.status === "pending" || m.status === "active") return true;
    if (seen.includes(m.id)) return false;
    if (m.status === "cancelled") return false;
    // il rifiuto interessa solo a chi ha invitato
    if (m.status === "declined") return m.creator_id === userId;
    return true;
  });

  const otherIds = [
    ...new Set(visible.map((m) => (m.creator_id === userId ? m.partner_id : m.creator_id))),
  ];
  const names = useQuery({
    queryKey: ["coop-names", otherIds.join(",")],
    queryFn: async () => {
      const rows = await Promise.all(otherIds.map((id) => fetchProfileById(id).catch(() => null)));
      return new Map(rows.filter((r) => r != null).map((r) => [r.id, r.nickname]));
    },
    enabled: otherIds.length > 0,
  });

  if (visible.length === 0) return null;

  async function act(task: () => Promise<unknown>) {
    setBusy(true);
    try {
      await task();
      await queryClient.invalidateQueries({ queryKey: ["coop", userId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Non riuscito");
    } finally {
      setBusy(false);
    }
  }

  function dismiss(id: string) {
    markSeen(id);
    setSeen((s) => [...s, id]);
  }

  return (
    <>
      {visible.map((m) => {
        const mine = m.creator_id === userId;
        const other = names.data?.get(mine ? m.partner_id : m.creator_id) ?? "il tuo amico";
        const rockName = m.rock?.name ?? "il sasso";
        const left = new Date(m.expires_at).getTime() - now;
        const iFound = Boolean(mine ? m.creator_found_at : m.partner_found_at);
        const theyFound = Boolean(mine ? m.partner_found_at : m.creator_found_at);
        const bonus = mine ? m.creator_bonus : m.partner_bonus;

        if (m.status === "pending" && !mine) {
          return (
            <Card key={m.id} tone="ink">
              <p className="font-display text-lg leading-tight">
                @{other} ti sfida a una Missione Co-op!
              </p>
              <p className="mt-1 text-xs text-white/70">
                Trovate entrambi “{rockName}” entro 30 minuti: tutti i punti che fate nel frattempo
                valgono ×2. L'invito scade tra {clock(left)}.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void act(async () => {
                      const res = await coopRespond(m.id, true);
                      if (res === "already_found") {
                        toast.error(
                          "Uno di voi ha già trovato quel sasso: missione annullata. Sceglietene un altro.",
                        );
                      } else {
                        toast.success("Missione iniziata: avete 30 minuti!");
                      }
                    })
                  }
                  className="press flex-1 rounded-xl bg-lime py-2.5 text-sm font-extrabold text-ink"
                >
                  {busy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Accetta"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void act(() => coopRespond(m.id, false))}
                  className="press rounded-xl bg-white/15 px-4 py-2.5 text-sm font-extrabold"
                >
                  Rifiuta
                </button>
              </div>
            </Card>
          );
        }

        if (m.status === "pending") {
          return (
            <Card key={m.id}>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 shrink-0 text-primary" />
                <p className="flex-1 text-xs font-bold">
                  In attesa che @{other} accetti la missione su “{rockName}” ({clock(left)})
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void act(() => coopCancel(m.id))}
                  className="press text-xs font-extrabold text-muted-foreground"
                >
                  Annulla
                </button>
              </div>
            </Card>
          );
        }

        if (m.status === "active") {
          return (
            <Card key={m.id} tone="brand">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 font-display text-lg leading-tight">
                  <Swords className="h-5 w-5" /> Co-op con @{other}
                </p>
                <span className="rounded-full bg-white/20 px-2.5 py-1 font-display text-base tabular-nums">
                  {clock(left)}
                </span>
              </div>
              <p className="mt-1 text-xs text-white/80">
                Obiettivo: “{rockName}” · punti ×2 se lo trovate entrambi
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-extrabold">
                <Status ok={iFound} label="Tu" />
                <Status ok={theyFound} label={`@${other}`} />
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => onGoToRock(m.rock_id)}
                  className="press flex-1 rounded-xl bg-white py-2.5 text-sm font-extrabold text-primary"
                >
                  Vai al sasso
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void act(() => coopCancel(m.id))}
                  className="press rounded-xl bg-white/15 px-3 py-2.5 text-xs font-extrabold"
                >
                  Abbandona
                </button>
              </div>
            </Card>
          );
        }

        const text =
          m.status === "success"
            ? `Missione riuscita con @${other}! +${(bonus ?? 0).toLocaleString("it-IT")} punti bonus (×2).`
            : m.status === "failed"
              ? `Tempo scaduto: la missione con @${other} su “${rockName}” non è riuscita.`
              : `@${other} ha rifiutato la missione.`;
        return (
          <Card key={m.id} tone={m.status === "success" ? "lime" : undefined}>
            <div className="flex items-center gap-2">
              {m.status === "success" ? (
                <PartyPopper className="h-5 w-5 shrink-0" />
              ) : (
                <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <p className="flex-1 text-xs font-extrabold">{text}</p>
              <button
                type="button"
                onClick={() => dismiss(m.id)}
                aria-label="Chiudi"
                className="press"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </Card>
        );
      })}
    </>
  );
}

function Status({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${
        ok ? "bg-lime text-ink" : "bg-white/20 text-white"
      }`}
    >
      {ok ? <Check className="h-3 w-3" strokeWidth={3} /> : <Clock className="h-3 w-3" />}
      {label} {ok ? "l'ha trovato" : "lo cerca"}
    </span>
  );
}

function Card({
  tone,
  children,
}: {
  tone?: "ink" | "brand" | "lime" | undefined;
  children: React.ReactNode;
}) {
  const cls =
    tone === "ink"
      ? "bg-ink text-ink-foreground shadow-lift"
      : tone === "brand"
        ? "bg-brand text-white shadow-glow"
        : tone === "lime"
          ? "bg-lime text-lime-foreground shadow-pebble"
          : "glass";
  return (
    <div
      className={`pointer-events-auto rounded-2xl px-3.5 py-3 animate-in fade-in slide-in-from-top-2 ${cls}`}
    >
      {children}
    </div>
  );
}
