import { showNotification } from "@/lib/notify";
import { submitRockRating } from "@/lib/points.functions";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { InstallPrompt } from "@/components/InstallPrompt";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchDoubleDays,
  fetchMyFinds,
  fetchRockPhoto,
  fetchRocks,
  moveRock,
  registerFind,
  type RockRow,
} from "@/lib/api";
import { adminMoveRock } from "@/lib/admin.functions";
import { lookupPlace } from "@/lib/geo.functions";
import { importLegacyRocks } from "@/lib/legacy";
import { enqueue, readQueue } from "@/lib/offline";
import {
  DEFAULT_POSITION,
  compressImage,
  distanceMeters,
  formatDistance,
  getPrecisePosition,
} from "@/lib/rockdex";
import { flushQueue } from "@/lib/sync";
import { saveMyLocation, fetchFriendLocations, type FriendLocation } from "@/lib/api";
import { useSession } from "@/lib/useSession";
import { matchRockPhoto, verifyRockPhoto } from "@/lib/vision.functions";

const MapView = lazy(() => import("@/components/MapView"));
const LocationPicker = lazy(() => import("@/components/LocationPicker"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RockDex — Trova sassi dipinti nascosti vicino a te" },
      {
        name: "description",
        content:
          "RockDex è la caccia al tesoro dei sassi dipinti: apri la mappa GPS, segui gli indizi e colleziona i sassi trovati.",
      },
      { property: "og:title", content: "RockDex — La caccia ai sassi dipinti" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      {
        property: "og:description",
        content: "Mappa GPS, indizi e badge: trova e nascondi sassi dipinti nella tua città.",
      },
    ],
  }),
  component: MapPage,
});

function notify(title: string, body: string) {
  void showNotification(title, body);
}


function MapPage() {
  const { loading, userId, profile, admin } = useSession();
  const adminMoveRockFn = useServerFn(adminMoveRock);
  const navigate = useNavigate();
  const [position, setPosition] = useState(DEFAULT_POSITION);
  const [rocks, setRocks] = useState<RockRow[]>([]);
  const [foundIds, setFoundIds] = useState<string[]>([]);
  const [selected, setSelected] = useState<RockRow | null>(null);
  const [visible, setVisible] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [bonus, setBonus] = useState(1);

  useEffect(() => setMounted(true), []);
  const [friends, setFriends] = useState<FriendLocation[]>([]);

  // Posizione in tempo reale: segue il GPS e la salva sul profilo (max ogni 10s).
  useEffect(() => {
    if (!userId || typeof navigator === "undefined" || !navigator.geolocation) return;
    let lastSave = 0;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setPosition({ lat, lng });
        const now = Date.now();
        if (now - lastSave < 10000) return;
        lastSave = now;
        saveMyLocation(userId, lat, lng).catch(() => undefined);
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 5000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [userId]);

  // Posizione degli amici, aggiornata ogni 12 secondi.
  useEffect(() => {
    if (!userId) return;
    const load = () => fetchFriendLocations(userId).then(setFriends).catch(() => undefined);
    load();
    const t = setInterval(load, 12000);
    return () => clearInterval(t);
  }, [userId]);

  // Giornata speciale: messaggio in cima alla mappa + notifica (una volta al giorno).
  useEffect(() => {
    if (!userId) return;
    fetchDoubleDays()
      .then((days) => {
        const today = new Date().toISOString().slice(0, 10);
        const multiplier = days.find((d) => d.day === today)?.multiplier ?? 1;
        setBonus(multiplier);
        if (multiplier <= 1) return;
        const key = `ciaorock.bonus-notified.${today}`;
        if (localStorage.getItem(key)) return;
        localStorage.setItem(key, "1");
        notify(
          "Ciao Rock: giornata speciale! 🎉",
          `Oggi ti regalo un x${multiplier} su tutti i punti che guadagni.`,
        );
      })
      .catch(() => undefined);
  }, [userId]);

  // Notifiche per i sassi vicini (entro 300 m) non ancora trovati.
  useEffect(() => {
    if (!rocks.length) return;
    for (const rock of rocks) {
      if (foundIds.includes(rock.id)) continue;
      if (distanceMeters(position, rock) > 300) continue;
      const key = `ciaorock.near-notified.${rock.id}`;
      if (localStorage.getItem(key)) continue;
      localStorage.setItem(key, "1");
      notify(
        "C'è un sasso vicino a te! 🪨",
        `"${rock.name}" è a ${formatDistance(distanceMeters(position, rock))} da qui.`,
      );
    }
  }, [rocks, foundIds, position]);


  useEffect(() => {
    if (!loading && (!userId || !profile?.nickname)) navigate({ to: "/auth" });
  }, [loading, userId, profile, navigate]);

  const reload = useCallback(async () => {
    try {
      const list = await fetchRocks();
      setRocks(list);
      if (userId) {
        const finds = await fetchMyFinds(userId);
        setFoundIds(finds.map((f) => f.rock?.id).filter((id): id is string => Boolean(id)));
      }
    } catch {
      /* offline: keep whatever we already show */
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    void reload();
    const channel = supabase
      .channel("rockdex-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "rocks" }, () => void reload())
      .on("postgres_changes", { event: "*", schema: "public", table: "finds" }, () => void reload())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, reload]);

  useEffect(() => {
    setOnline(navigator.onLine);
    setPending(readQueue().length);
    const sync = async () => {
      setOnline(navigator.onLine);
      const { synced, rejected } = await flushQueue(userId);
      setPending(readQueue().length);
      if (synced > 0) {
        setToast(
          `${synced} azione${synced === 1 ? "" : "i"} offline sincronizzat${synced === 1 ? "a" : "e"} ✅`,
        );
        void reload();
      }
      if (rejected > 0) {
        setToast(
          `${rejected} foto offline scartat${rejected === 1 ? "a" : "e"}: non mostrava un sasso dipinto ❌`,
        );
      }
    };
    const queueChanged = () => setPending(readQueue().length);
    window.addEventListener("online", sync);
    window.addEventListener("offline", () => setOnline(false));
    window.addEventListener("rockdex-queue", queueChanged);
    void sync();
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("rockdex-queue", queueChanged);
    };
  }, [userId, reload]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Recupera i sassi creati con le versioni precedenti (salvati solo su questo dispositivo).
  useEffect(() => {
    if (!userId) return;
    importLegacyRocks()
      .then((n) => {
        if (n > 0) {
          setToast(`${n} sass${n === 1 ? "o" : "i"} delle versioni precedenti importat${n === 1 ? "o" : "i"} 🪨`);
          void reload();
        }
      })
      .catch(() => undefined);
  }, [userId, reload]);


  useEffect(() => {
    getPrecisePosition()
      .then((pos) => setPosition({ lat: pos.lat, lng: pos.lng }))
      .catch(() => undefined);
  }, []);

  const nickname = profile?.nickname ?? "";

  const handleAdminMove = useCallback(
    async (rock: RockRow, lat: number, lng: number) => {
      try {
        await adminMoveRockFn({ data: { rockId: rock.id, lat, lng } });
        setToast(`"${rock.name}" spostato nella nuova posizione ✅`);
        void reload();
      } catch (err) {
        setToast(err instanceof Error ? err.message : "Spostamento non riuscito");
        void reload();
      }
    },
    [adminMoveRockFn, reload],
  );

  return (
    <AppShell title="Mappa" bare>
      <div className="relative h-[100vh] w-full">
        <div className="absolute inset-0">
          {mounted ? (
            <Suspense fallback={<MapSkeleton />}>
              <MapView
                rocks={rocks}
                me={position}
                friends={friends}
                foundIds={foundIds}
                onSelect={setSelected}
                onVisibleCount={setVisible}
                adminMove={admin}
                onAdminMove={handleAdminMove}
                onAdminHoldStart={() =>
                  setToast("Tieni premuto 5 secondi per sbloccare lo spostamento del sasso…")
                }
                onAdminHoldCancel={() => setToast(null)}
                onAdminArmed={(rock) =>
                  setToast(`"${rock.name}" sbloccato: ora tocca il punto della mappa dove spostarlo 👆`)
                }
              />
            </Suspense>
          ) : (
            <MapSkeleton />
          )}
        </div>

        <div className="pointer-events-none absolute inset-x-0 top-0 z-[900] space-y-2 p-4">
          <div className="pebble-card pointer-events-auto flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-lg font-bold leading-tight">Ciao {nickname} 👋</p>
              <p className="text-xs text-muted-foreground">
                {visible} sassi in questa zona · {rocks.length} totali · {foundIds.length} trovati
              </p>
            </div>
            <span className="grid h-11 w-11 place-items-center rounded-full bg-secondary text-2xl">
              🪨
            </span>
          </div>
          {bonus > 1 && (
            <div className="pebble-card pointer-events-auto px-4 py-2 text-xs font-bold text-foreground">
              🎉 Ciao! Oggi ti regalo un x{bonus} su tutti i punti che guadagni.
            </div>
          )}
          {(!online || pending > 0) && (
            <div className="pebble-card pointer-events-auto px-4 py-2 text-xs font-semibold text-muted-foreground">
              {online
                ? `📡 ${pending} azione in attesa di sincronizzazione`
                : "📴 Modalità offline: le tue azioni verranno salvate e inviate al ritorno del segnale"}
            </div>
          )}
          {toast && (
            <div className="pebble-card pointer-events-auto px-4 py-2 text-xs font-bold text-foreground">
              {toast}
            </div>
          )}
        </div>

        {selected && (
          <RockSheet
            rock={selected}
            userId={userId}
            me={position}
            found={foundIds.includes(selected.id)}
            onClose={() => setSelected(null)}
            onDone={(message) => {
              setToast(message);
              setSelected(null);
              void reload();
            }}
          />
        )}

        {mounted && <InstallPrompt />}
      </div>
    </AppShell>
  );
}

function MapSkeleton() {
  return (
    <div className="grid h-full w-full place-items-center bg-muted text-sm text-muted-foreground">
      Caricamento mappa…
    </div>
  );
}

function RockSheet({
  rock,
  userId,
  me,
  found,
  onClose,
  onDone,
}: {
  rock: RockRow;
  userId: string | null;
  me: { lat: number; lng: number };
  found: boolean;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [mode, setMode] = useState<"view" | "find" | "move">("view");
  const [proof, setProof] = useState<string | null>(null);
  const [clue, setClue] = useState(rock.clue);
  const [target, setTarget] = useState({ lat: rock.lat, lng: rock.lng });
  const [busy, setBusy] = useState(false);
  const [rating, setRating] = useState(false);
  const [stars, setStars] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const submitRating = useServerFn(submitRockRating);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [approved, setApproved] = useState(false);
  const [verdict, setVerdict] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const place = useServerFn(lookupPlace);
  const checkPhoto = useServerFn(verifyRockPhoto);
  const comparePhoto = useServerFn(matchRockPhoto);

  useEffect(() => {
    let active = true;
    fetchRockPhoto(rock.id)
      .then((value) => {
        if (active) setPhoto(value);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [rock.id]);

  useEffect(() => {
    if (mode !== "move") return;
    getPrecisePosition()
      .then((pos) => setTarget({ lat: pos.lat, lng: pos.lng }))
      .catch(() => undefined);
  }, [mode]);

  async function pickProof(file: File | undefined) {
    if (!file) return;
    setError(null);
    setApproved(false);
    setVerdict(null);
    const dataUrl = await compressImage(file);
    setProof(dataUrl);
    if (!navigator.onLine) {
      setVerdict("Offline: la verifica AI verrà fatta al ritorno del segnale.");
      return;
    }
    setChecking(true);
    try {
      const res = photo
        ? await comparePhoto({ data: { photo: dataUrl, reference: photo } })
        : await checkPhoto({ data: { photo: dataUrl } });
      setApproved(res.approved);
      setVerdict(res.message);
    } catch {
      setApproved(false);
      setVerdict("Verifica della foto non riuscita. Riprova.");
    } finally {
      setChecking(false);
    }
  }

  function proofBlocked() {
    if (checking) {
      setError("Attendi la verifica AI della foto.");
      return true;
    }
    if (navigator.onLine && !approved) {
      setError(
        "La verifica AI non ha riconosciuto un sasso dipinto nella foto: scatta una foto nitida del sasso.",
      );
      return true;
    }
    return false;
  }

  async function confirmFind() {
    if (!proof) return setError("Serve la foto-prova del sasso che hai trovato.");
    if (proofBlocked()) return;
    setBusy(true);
    setError(null);
    try {
      if (!navigator.onLine) {
        enqueue({
          kind: "find",
          payload: { rockId: rock.id, photo: proof, lat: me.lat, lng: me.lng },
        });
        onDone("Ritrovamento salvato offline: lo invio appena torna il segnale 📴");
        return;
      }
      const resolved = await place({ data: { lat: me.lat, lng: me.lng } }).catch(() => ({
        city: null,
        region: null,
        country: null,
        continent: null,
      }));
      await registerFind({ rockId: rock.id, photo: proof, lat: me.lat, lng: me.lng, place: resolved });
      setRating(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registrazione non riuscita.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmMove() {
    if (!proof) return setError("Carica la foto del sasso nel nuovo nascondiglio.");
    if (proofBlocked()) return;
    if (clue.trim().length < 10) return setError("Scrivi un nuovo indizio di almeno 10 caratteri.");
    if (!userId) return setError("Sessione scaduta: accedi di nuovo.");
    setBusy(true);
    setError(null);
    try {
      if (!navigator.onLine) {
        enqueue({
          kind: "move",
          payload: {
            rockId: rock.id,
            clue: clue.trim(),
            photo: proof,
            lat: target.lat,
            lng: target.lng,
          },
        });
        onDone("Spostamento salvato offline: lo invio appena torna il segnale 📴");
        return;
      }
      await moveRock({
        rockId: rock.id,
        clue: clue.trim(),
        photo: proof,
        lat: target.lat,
        lng: target.lng,
        userId,
        moveCount: rock.move_count,
      });
      onDone(`“${rock.name}” è stato nascosto in un nuovo posto 🪨`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Spostamento non riuscito.");
    } finally {
      setBusy(false);
    }
  }

  if (rating) {
    const finish = (msg: string) =>
      onDone(`Hai trovato “${rock.name}”! 🎉 +${rock.points} punti. ${msg}`);
    return (
      <div className="absolute inset-0 z-[900] grid place-items-center bg-foreground/40 p-6">
        <div className="pebble-card w-full max-w-sm space-y-4 bg-card p-6 text-center">
          <h2 className="text-xl font-bold">Valuta la difficoltà di questo nascondiglio</h2>
          <p className="text-sm text-muted-foreground">0 stelle = banale · 5 stelle = difficilissimo</p>
          <div className="flex justify-center gap-1 text-4xl">
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-label={`${n} stelle`}
                disabled={busy}
                onClick={() => setStars(n)}
                className={n === 0 ? "text-2xl" : ""}
              >
                {n === 0 ? (stars === 0 ? "⓪" : "0") : stars != null && n <= stars ? "★" : "☆"}
              </button>
            ))}
          </div>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value.slice(0, 500))}
            rows={3}
            placeholder="Com'è stato trovarlo? es. “banale, era in piena vista” oppure “difficilissimo, mimetizzato tra i sassi”"
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
          />
          <button
            type="button"
            disabled={busy || stars == null}
            onClick={async () => {
              if (stars == null) return;
              setBusy(true);
              try {
                await submitRating({ data: { rockId: rock.id, stars, feedback } });
                finish("Grazie per il voto ⭐");
              } catch {
                finish("Voto non salvato.");
              }
            }}
            className="w-full rounded-xl bg-primary py-3 font-bold text-primary-foreground disabled:opacity-50"
          >
            {busy ? "Invio…" : "Invia valutazione"}
          </button>
          <p className="text-xs text-muted-foreground">Dopo almeno 3 voti, i punti del sasso salgono o scendono in base a stelle e commenti.</p>
          <button type="button" onClick={() => finish("")} className="text-sm font-bold text-muted-foreground">
            Salta
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-[850] flex items-end bg-foreground/30" onClick={onClose}>
      <div
        className="max-h-[88vh] w-full overflow-y-auto rounded-t-[2rem] border-t border-border bg-card p-5 pb-28 shadow-lift"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-border" />
        {photo ? (
          <img
            src={photo}
            alt={`Sasso dipinto: ${rock.name}`}
            className="mb-4 h-44 w-full rounded-2xl object-cover"
            loading="lazy"
          />
        ) : (
          <div className="mb-4 grid h-44 w-full place-items-center rounded-2xl bg-muted text-sm text-muted-foreground">
            Caricamento foto…
          </div>
        )}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold leading-tight">{rock.name}</h2>
            <p className="text-sm text-muted-foreground">
              Creato da {rock.creator_nickname}
              {rock.hider_nickname && rock.hider_nickname !== rock.creator_nickname
                ? ` · nascosto da ${rock.hider_nickname}`
                : ""}
            </p>
          </div>
          <span className="rounded-full bg-secondary px-3 py-1 text-xs font-bold text-secondary-foreground">
            {rock.difficulty} · {rock.points}pt
          </span>
        </div>

        <div className="mt-4 rounded-2xl bg-muted p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Indizio</p>
          <p className="mt-1 text-sm">{rock.clue}</p>
        </div>

        <div className="mt-3 flex flex-wrap gap-3 text-sm font-semibold text-foreground">
          <span>📍 {formatDistance(distanceMeters(me, rock))}</span>
          <span>🔁 spostato {rock.move_count} volte</span>
          <span>🏆 trovato {rock.found_count} volte</span>
          {rock.rating_count > 0 && rock.rating_avg != null && (
            <span>⭐ {rock.rating_avg.toFixed(1)} ({rock.rating_count} voti)</span>
          )}
        </div>

        {mode !== "view" && (
          <div className="mt-4 space-y-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="grid h-40 w-full place-items-center overflow-hidden rounded-2xl border-2 border-dashed border-border bg-muted"
            >
              {proof ? (
                <img src={proof} alt="Foto-prova" className="h-full w-full object-cover" />
              ) : (
                <span className="px-6 text-center text-sm text-muted-foreground">
                  📷 Tocca per scattare la foto{mode === "find" ? "-prova del ritrovamento" : " del nuovo nascondiglio"}
                </span>
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => void pickProof(e.target.files?.[0])}
            />

            {(checking || verdict) && (
              <div
                className={`rounded-xl p-3 text-sm font-semibold ${
                  checking
                    ? "bg-muted text-muted-foreground"
                    : approved
                      ? "bg-primary/10 text-foreground"
                      : "bg-destructive/10 text-destructive"
                }`}
              >
                {checking ? "🔍 Verifica AI della foto in corso…" : verdict}
              </div>
            )}



            {mode === "move" && (
              <>
                <textarea
                  value={clue}
                  onChange={(e) => setClue(e.target.value)}
                  rows={3}
                  placeholder="Nuovo indizio per il nuovo nascondiglio"
                  className="w-full rounded-xl border border-input bg-background px-4 py-3 text-base outline-none focus:border-ring"
                />
                <Suspense
                  fallback={
                    <div className="grid h-56 place-items-center rounded-2xl bg-muted text-sm text-muted-foreground">
                      Caricamento mappa…
                    </div>
                  }
                >
                  <LocationPicker value={target} onChange={setTarget} />
                </Suspense>
                <p className="font-mono text-xs text-muted-foreground">
                  {target.lat.toFixed(6)}, {target.lng.toFixed(6)}
                </p>
              </>
            )}

            {error && <p className="text-sm font-semibold text-destructive">{error}</p>}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setMode("view");
                  setProof(null);
                  setError(null);
                  setApproved(false);
                  setVerdict(null);
                }}
                className="flex-1 rounded-xl border border-border bg-card py-3 text-sm font-bold text-muted-foreground"
              >
                Annulla
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void (mode === "find" ? confirmFind() : confirmMove())}
                className="flex-1 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-pebble disabled:opacity-60"
              >
                {busy ? "Invio…" : mode === "find" ? "Conferma ritrovamento" : "Conferma spostamento"}
              </button>
            </div>
          </div>
        )}

        {mode === "view" && (
          <div className="mt-5 space-y-2">
            <button
              type="button"
              onClick={() => setMode("find")}
              disabled={found}
              className="w-full rounded-xl bg-primary py-3 text-base font-bold text-primary-foreground shadow-pebble disabled:bg-muted disabled:text-muted-foreground"
            >
              {found ? "Già trovato ✅" : "L'ho trovato! (con foto-prova)"}
            </button>
            <button
              type="button"
              onClick={() => setMode("move")}
              className="w-full rounded-xl border border-border bg-card py-3 text-base font-bold text-foreground"
            >
              🔁 Sposta / nascondi di nuovo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
