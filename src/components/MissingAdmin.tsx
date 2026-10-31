import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { adminListMissing, adminResolveMissing, type MissingRock } from "@/lib/admin.functions";

/** Admin: sassi segnalati come smarriti, con foto, chi e quando; si decide se toglierli. */
export function MissingAdmin({ onChanged }: { onChanged?: () => void }) {
  const list = useServerFn(adminListMissing);
  const resolve = useServerFn(adminResolveMissing);
  const [rocks, setRocks] = useState<MissingRock[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);

  async function load() {
    try {
      setRocks(await list({}));
    } catch (err) {
      setRocks([]);
      toast.error(err instanceof Error ? err.message : "Errore di caricamento");
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function act(rock: MissingRock, action: "remove" | "dismiss") {
    if (action === "remove" && !window.confirm(`Togliere “${rock.name}” dalla mappa?`)) return;
    setBusy(rock.rock_id);
    try {
      await resolve({ data: { rockId: rock.rock_id, action } });
      toast.success(
        action === "remove"
          ? "Sasso tolto dalla mappa (è nel cestino, si può ripristinare)"
          : "Segnalazioni ignorate: il sasso resta sulla mappa",
      );
      await load();
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Non riuscito");
    } finally {
      setBusy(null);
    }
  }

  if (!rocks) {
    return (
      <p className="pebble-card flex items-center gap-2 p-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carico le segnalazioni…
      </p>
    );
  }
  if (!rocks.length) {
    return (
      <p className="pebble-card p-5 text-sm text-muted-foreground">
        Nessun sasso segnalato come smarrito. Alla terza segnalazione di giocatori diversi ricevi
        una notifica.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {rocks.map((rock) => {
        const many = rock.reports.length >= 3;
        return (
          <div key={rock.rock_id} className="pebble-card space-y-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold">{rock.name}</p>
                <p className="line-clamp-2 text-xs text-muted-foreground">{rock.clue}</p>
                <a
                  href={`https://www.openstreetmap.org/?mlat=${rock.lat}&mlon=${rock.lng}#map=19/${rock.lat}/${rock.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-primary underline"
                >
                  <MapPin className="h-3 w-3" /> Vedi sulla mappa
                </a>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${
                  many ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground"
                }`}
              >
                {rock.reports.length} segnalazion{rock.reports.length === 1 ? "e" : "i"}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {rock.reports.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setZoom(r.photo)}
                  className="press overflow-hidden rounded-xl bg-muted text-left"
                >
                  <img src={r.photo} alt="" className="aspect-square w-full object-cover" />
                  <p className="truncate px-1.5 pt-1 text-[11px] font-bold">@{r.nickname}</p>
                  <p className="px-1.5 pb-1.5 text-[10px] text-muted-foreground">
                    {new Date(r.created_at).toLocaleString("it-IT", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void act(rock, "dismiss")}
                className="press flex-1 rounded-xl bg-muted py-2.5 text-sm font-extrabold"
              >
                Il sasso c'è: ignora
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void act(rock, "remove")}
                className="press flex-1 rounded-xl bg-destructive py-2.5 text-sm font-extrabold text-white"
              >
                {busy === rock.rock_id ? (
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                ) : (
                  "Togli dalla mappa"
                )}
              </button>
            </div>
          </div>
        );
      })}
      {zoom && (
        <div
          className="fixed inset-0 z-[1100] grid place-items-center bg-ink/80 p-4"
          onClick={() => setZoom(null)}
        >
          <img src={zoom} alt="Foto della segnalazione" className="max-h-full rounded-2xl" />
        </div>
      )}
    </div>
  );
}
