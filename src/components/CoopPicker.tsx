import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Loader2, MapPin, Swords, X } from "lucide-react";
import { toast } from "sonner";
import { coopInvite, fetchMyFinds, fetchRocks, type ProfileRow } from "@/lib/api";
import {
  DEFAULT_POSITION,
  distanceMeters,
  formatDistance,
  getPrecisePosition,
} from "@/lib/rockdex";

/**
 * Scelta del sasso per una Missione Co-op: sassi che non hai già trovato e che non sono stati
 * creati da te o dal tuo amico, dal più vicino. Il database ricontrolla tutto all'invio.
 */
export function CoopPicker({
  userId,
  partner,
  onClose,
}: {
  userId: string;
  partner: ProfileRow;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [here, setHere] = useState(DEFAULT_POSITION);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    getPrecisePosition()
      .then((p) => setHere({ lat: p.lat, lng: p.lng }))
      .catch(() => undefined);
  }, []);

  const rocks = useQuery({ queryKey: ["rocks"], queryFn: fetchRocks });
  const finds = useQuery({ queryKey: ["my-finds", userId], queryFn: () => fetchMyFinds(userId) });
  const found = new Set((finds.data ?? []).map((f) => f.rock?.id));
  const candidates = (rocks.data ?? [])
    .filter((r) => !found.has(r.id) && r.creator_id !== userId && r.creator_id !== partner.id)
    .map((r) => ({ rock: r, distance: distanceMeters(here, r) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 30);

  async function invite(rockId: string, name: string) {
    setBusy(rockId);
    try {
      await coopInvite(partner.id, rockId);
      await queryClient.invalidateQueries({ queryKey: ["coop", userId] });
      toast.success(`Invito inviato a @${partner.nickname}`, {
        description: `Obiettivo: “${name}”. Quando accetta parte il timer di 30 minuti.`,
      });
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invito non riuscito");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[1060] flex items-end bg-ink/40 backdrop-blur-[2px] animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="mx-auto max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-[2.25rem] bg-card p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-lift animate-in slide-in-from-bottom-10 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl leading-tight">Missione Co-op</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Scegli il sasso da trovare con @{partner.nickname}. Avete 30 minuti: se lo trovate
              entrambi, i punti di tutti i sassi trovati durante la missione valgono ×2.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi"
            className="press grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {(rocks.isLoading || finds.isLoading) && (
            <p className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Cerco i sassi…
            </p>
          )}
          {!rocks.isLoading && !finds.isLoading && candidates.length === 0 && (
            <p className="rounded-2xl bg-muted p-4 text-sm text-muted-foreground">
              Nessun sasso disponibile: li avete già trovati tutti (o li avete creati voi)!
            </p>
          )}
          {candidates.map(({ rock, distance }) => (
            <button
              key={rock.id}
              type="button"
              disabled={busy !== null}
              onClick={() => void invite(rock.id, rock.name)}
              className="press pebble-card flex w-full items-center gap-3 rounded-[1.3rem] p-3 text-left disabled:opacity-60"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
                {busy === rock.id ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Swords className="h-5 w-5" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-extrabold">{rock.name}</span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" /> {formatDistance(distance)} · {rock.difficulty}
                </span>
              </span>
              <span className="shrink-0 font-display text-base">{rock.points} pt</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
