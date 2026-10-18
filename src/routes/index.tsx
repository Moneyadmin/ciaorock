import { showNotification } from "@/lib/notify";
import { submitRockRating } from "@/lib/points.functions";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  CheckCircle2,
  Gem,
  Lightbulb,
  Loader2,
  MapPin,
  Navigation,
  Repeat2,
  ScanSearch,
  Star,
  Trophy,
  WifiOff,
  Zap,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { InstallPrompt } from "@/components/InstallPrompt";
import { CoopPanel, useCoopMissions } from "@/components/CoopPanel";
import { Tutorial, tutorialPending } from "@/components/Tutorial";
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
import { importLegacyRocks } from "@/lib/legacy";
import { announceRewards } from "@/lib/rewards";
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
import { avatarGradient, initialOf } from "@/lib/pins";
import { matchRockPhoto } from "@/lib/vision.functions";
import { ADMIN_HOLD_MS, FIND_RADIUS_M, HIDE_RADIUS_M } from "@/lib/rules";

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
  // Admin: sasso da confermare dopo la pressione lunga, e sasso in attesa della nuova posizione.
  const [askMove, setAskMove] = useState<RockRow | null>(null);
  const [moving, setMoving] = useState<RockRow | null>(null);
  const askOpenedAt = useRef(0);

  useEffect(() => setMounted(true), []);
  const [tutorial, setTutorial] = useState(false);

  // Primo accesso: mostra il tutorial una volta sola (per utente, su questo dispositivo).
  useEffect(() => {
    if (userId && profile?.nickname && tutorialPending(userId)) setTutorial(true);
  }, [userId, profile?.nickname]);
  const [friends, setFriends] = useState<FriendLocation[]>([]);
  const missions = useCoopMissions(userId);
  const targetIds = missions.filter((m) => m.status === "active").map((m) => m.rock_id);

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
    const load = () =>
      fetchFriendLocations(userId)
        .then(setFriends)
        .catch(() => undefined);
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
          `${rejected} azion${rejected === 1 ? "e" : "i"} offline rifiutat${rejected === 1 ? "a" : "e"} (foto non valida o troppo lontano dal sasso)`,
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
          setToast(
            `${n} sass${n === 1 ? "o" : "i"} delle versioni precedenti importat${n === 1 ? "o" : "i"} 🪨`,
          );
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

  useEffect(() => {
    if (!moving) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoving(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moving]);

  const handleAdminMove = useCallback(
    async (rock: RockRow, lat: number, lng: number) => {
      setMoving(null);
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
      <div className="relative h-[100dvh] w-full">
        <div className="absolute inset-0">
          {mounted ? (
            <Suspense fallback={<MapSkeleton />}>
              <MapView
                rocks={rocks}
                me={position}
                friends={friends}
                targetIds={targetIds}
                foundIds={foundIds}
                onSelect={setSelected}
                onVisibleCount={setVisible}
                adminMove={admin && !askMove}
                armedId={moving?.id ?? null}
                onAdminMove={handleAdminMove}
                onAdminHoldStart={() =>
                  setToast(
                    `Admin: continua a tenere premuto ${ADMIN_HOLD_MS / 1000} secondi per spostare il sasso…`,
                  )
                }
                onAdminHoldCancel={() => setToast(null)}
                onAdminHoldDone={(rock) => {
                  setToast(null);
                  setSelected(null);
                  askOpenedAt.current = Date.now();
                  setAskMove(rock);
                }}
              />
            </Suspense>
          ) : (
            <MapSkeleton />
          )}
        </div>

        <div className="pointer-events-none absolute inset-x-0 top-0 z-[900] space-y-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="glass pointer-events-auto flex items-center gap-3 rounded-[1.6rem] p-2.5 pr-4">
            <span
              className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl font-display text-xl text-white"
              style={{ background: avatarGradient(nickname || "?") }}
            >
              {initialOf(nickname || "?")}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-xl leading-tight">Ciao {nickname}!</p>
              <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] font-bold">
                <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground">
                  <MapPin className="h-3 w-3" strokeWidth={2.6} />
                  {visible} qui
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                  <Gem className="h-3 w-3" strokeWidth={2.6} />
                  {rocks.length} totali
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-moss/15 px-2 py-0.5 text-[oklch(0.45_0.12_162)]">
                  <CheckCircle2 className="h-3 w-3" strokeWidth={2.6} />
                  {foundIds.length} trovati
                </span>
              </div>
            </div>
          </div>
          {userId && (
            <CoopPanel
              userId={userId}
              missions={missions}
              onGoToRock={(rockId) => {
                const rock = rocks.find((r) => r.id === rockId);
                if (rock) setSelected(rock);
                else setToast("Il sasso della missione non è più sulla mappa.");
              }}
            />
          )}
          {bonus > 1 && (
            <div className="pointer-events-auto flex items-center gap-2 rounded-2xl bg-lime px-3.5 py-2.5 text-xs font-extrabold text-lime-foreground shadow-pebble">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink text-lime">
                <Zap className="h-4 w-4" fill="currentColor" />
              </span>
              Giornata speciale: oggi tutti i punti valgono x{bonus}!
            </div>
          )}
          {(!online || pending > 0) && (
            <div className="glass pointer-events-auto flex items-center gap-2 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-muted-foreground">
              <WifiOff className="h-4 w-4 shrink-0" />
              {online
                ? `${pending} azione in attesa di sincronizzazione`
                : "Modalità offline: le tue azioni verranno salvate e inviate al ritorno del segnale"}
            </div>
          )}
          {toast && (
            <div className="pointer-events-auto animate-in fade-in slide-in-from-top-2 rounded-2xl bg-ink px-4 py-3 text-xs font-bold text-ink-foreground shadow-lift">
              {toast}
            </div>
          )}
        </div>

        {moving && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[950] p-3 pb-[calc(env(safe-area-inset-bottom)+6.5rem)]">
            <div className="pointer-events-auto mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-ink-foreground shadow-lift animate-in fade-in slide-in-from-bottom-2">
              <p className="flex-1 text-xs font-bold">
                Tocca il punto della mappa dove spostare “{moving.name}”
              </p>
              <button
                type="button"
                onClick={() => {
                  setMoving(null);
                  setToast("Spostamento annullato: il sasso è rimasto dov'era.");
                }}
                className="press shrink-0 rounded-xl bg-white/15 px-3.5 py-2 text-xs font-extrabold"
              >
                Esci senza spostare
              </button>
            </div>
          </div>
        )}

        {askMove && (
          <div
            className="fixed inset-0 z-[1070] grid place-items-center bg-ink/40 p-6 backdrop-blur-[2px] animate-in fade-in"
            onClick={() => {
              // il dito che si stacca dalla pressione lunga non deve chiudere subito la domanda
              if (Date.now() - askOpenedAt.current > 700) setAskMove(null);
            }}
          >
            <div
              role="alertdialog"
              aria-labelledby="move-title"
              className="w-full max-w-sm rounded-[1.75rem] bg-card p-5 shadow-lift"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="move-title" className="text-xl leading-tight">
                Vuoi spostare questo sasso?
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                “{askMove.name}”: dopo la conferma tocca la mappa nel punto in cui metterlo. Puoi
                sempre uscire senza spostarlo.
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setAskMove(null)}
                  className="press flex-1 rounded-2xl bg-muted py-3 text-sm font-extrabold text-muted-foreground"
                >
                  No
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMoving(askMove);
                    setAskMove(null);
                  }}
                  className="press bg-brand flex-[1.4] rounded-2xl py-3 text-sm font-extrabold text-white shadow-glow"
                >
                  Sì, spostalo
                </button>
              </div>
            </div>
          </div>
        )}

        {selected && (
          <RockSheet
            rock={selected}
            userId={userId}
            me={position}
            found={foundIds.includes(selected.id)}
            mine={selected.creator_id === userId}
            onClose={() => setSelected(null)}
            onDone={(message) => {
              setToast(message);
              setSelected(null);
              void reload();
              void announceRewards();
            }}
          />
        )}

        {tutorial && userId && <Tutorial userId={userId} onClose={() => setTutorial(false)} />}
        {mounted && !tutorial && <InstallPrompt />}
      </div>
    </AppShell>
  );
}

function MapSkeleton() {
  return (
    <div className="grid h-full w-full place-items-center bg-muted text-sm font-semibold text-muted-foreground">
      <span className="inline-flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Caricamento mappa…
      </span>
    </div>
  );
}

function RockSheet({
  rock,
  userId,
  me,
  found,
  mine,
  onClose,
  onDone,
}: {
  rock: RockRow;
  userId: string | null;
  me: { lat: number; lng: number };
  found: boolean;
  mine: boolean;
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
  const [token, setToken] = useState<string | undefined>(undefined);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const comparePhoto = useServerFn(matchRockPhoto);
  const distance = distanceMeters(me, rock);
  const near = distance <= FIND_RADIUS_M;
  const canMove = mine || found;

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
    setToken(undefined);
    const dataUrl = await compressImage(file);
    setProof(dataUrl);
    if (!navigator.onLine) {
      setVerdict("Offline: la verifica AI verrà fatta al ritorno del segnale.");
      return;
    }
    setChecking(true);
    try {
      const res = await comparePhoto({ data: { rockId: rock.id, photo: dataUrl } });
      setApproved(res.approved);
      setVerdict(res.message);
      setToken(res.token);
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

  function tooFar() {
    if (near) return false;
    setError(
      `Sei a ${formatDistance(distance)} dal sasso: avvicinati a meno di ${FIND_RADIUS_M} m e riprova.`,
    );
    return true;
  }

  async function confirmFind() {
    if (tooFar()) return;
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
      await registerFind({ rockId: rock.id, photo: proof, lat: me.lat, lng: me.lng, token });
      setRating(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registrazione non riuscita.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmMove() {
    if (tooFar()) return;
    if (distanceMeters(me, target) > HIDE_RADIUS_M) {
      return setError(
        `Il nuovo nascondiglio deve essere vicino a dove ti trovi (entro ${HIDE_RADIUS_M} m).`,
      );
    }
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
            fromLat: me.lat,
            fromLng: me.lng,
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
        fromLat: me.lat,
        fromLng: me.lng,
        token,
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
      <div className="absolute inset-0 z-[1050] grid place-items-center bg-ink/50 p-5 backdrop-blur-sm">
        <div className="pebble-card w-full max-w-sm space-y-4 rounded-[2rem] bg-card p-6 text-center animate-in zoom-in-95 fade-in">
          <span className="bg-brand mx-auto grid h-16 w-16 place-items-center rounded-3xl text-white shadow-glow">
            <Trophy className="h-8 w-8" strokeWidth={2.4} />
          </span>
          <h2 className="text-2xl leading-tight">Quanto era difficile trovarlo?</h2>
          <p className="text-sm text-muted-foreground">
            0 stelle = banale · 5 stelle = difficilissimo
          </p>
          <div className="flex items-center justify-center gap-1.5">
            {[0, 1, 2, 3, 4, 5].map((n) => {
              const on = stars != null && n <= stars && n > 0;
              return (
                <button
                  key={n}
                  type="button"
                  aria-label={`${n} stelle`}
                  aria-pressed={stars === n}
                  disabled={busy}
                  onClick={() => setStars(n)}
                  className={
                    n === 0
                      ? `press mr-1 grid h-9 w-9 place-items-center rounded-full text-sm font-extrabold ${
                          stars === 0 ? "bg-ink text-white" : "bg-muted text-muted-foreground"
                        }`
                      : "press"
                  }
                >
                  {n === 0 ? (
                    "0"
                  ) : (
                    <Star
                      className={`h-9 w-9 ${on ? "text-sun" : "text-border"}`}
                      fill="currentColor"
                      strokeWidth={1.5}
                    />
                  )}
                </button>
              );
            })}
          </div>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value.slice(0, 500))}
            rows={3}
            placeholder="Com'è stato trovarlo? es. “banale, era in piena vista” oppure “difficilissimo, mimetizzato tra i sassi”"
            className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-ring focus:ring-4 focus:ring-ring/15"
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
            className="press bg-brand w-full rounded-2xl py-3.5 font-extrabold text-white shadow-glow disabled:opacity-50"
          >
            {busy ? "Invio…" : "Invia valutazione"}
          </button>
          <p className="text-xs text-muted-foreground">
            Dopo almeno 3 voti, i punti del sasso salgono o scendono in base a stelle e commenti.
          </p>
          <button
            type="button"
            onClick={() => finish("")}
            className="press text-sm font-bold text-muted-foreground"
          >
            Salta
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="absolute inset-0 z-[1050] flex items-end bg-ink/40 backdrop-blur-[2px] animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="max-h-[90dvh] w-full overflow-y-auto rounded-t-[2.25rem] bg-card p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-lift animate-in slide-in-from-bottom-10 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-border" />
        <div className="relative">
          {photo ? (
            <img
              src={photo}
              alt={`Sasso dipinto: ${rock.name}`}
              className="h-52 w-full rounded-[1.6rem] object-cover"
              loading="lazy"
            />
          ) : (
            <div className="grid h-52 w-full place-items-center rounded-[1.6rem] bg-muted text-sm font-semibold text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Caricamento foto…
              </span>
            </div>
          )}
          <span className="bg-brand absolute right-3 top-3 rounded-full px-3 py-1.5 font-display text-sm text-white shadow-glow">
            {rock.points} pt
          </span>
          {found && (
            <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-moss px-3 py-1.5 text-xs font-extrabold text-white">
              <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={3} /> Trovato
            </span>
          )}
        </div>
        <div className="mt-4 flex items-start justify-between gap-3 px-1">
          <div className="min-w-0">
            <h2 className="text-[1.75rem] leading-tight">{rock.name}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Creato da <span className="font-bold text-foreground">@{rock.creator_nickname}</span>
              {rock.hider_nickname && rock.hider_nickname !== rock.creator_nickname
                ? ` · nascosto da @${rock.hider_nickname}`
                : ""}
            </p>
          </div>
          <DifficultyChip level={rock.difficulty} />
        </div>

        <div className="mt-4 flex gap-3 rounded-[1.4rem] bg-secondary p-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Lightbulb className="h-5 w-5" strokeWidth={2.4} />
          </span>
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-secondary-foreground">
              Indizio
            </p>
            <p className="mt-0.5 text-[15px] font-medium leading-snug">{rock.clue}</p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-[13px] font-bold">
          <StatChip
            icon={<Navigation className="h-4 w-4" />}
            label={formatDistance(distanceMeters(me, rock))}
          />
          <StatChip
            icon={<Trophy className="h-4 w-4" />}
            label={`Trovato ${rock.found_count} volte`}
          />
          <StatChip
            icon={<Repeat2 className="h-4 w-4" />}
            label={`Spostato ${rock.move_count} volte`}
          />
          {rock.rating_count > 0 && rock.rating_avg != null && (
            <StatChip
              icon={<Star className="h-4 w-4 text-sun" fill="currentColor" />}
              label={`${rock.rating_avg.toFixed(1)} (${rock.rating_count} voti)`}
            />
          )}
        </div>

        {mode !== "view" && (
          <div className="mt-4 space-y-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="press grid h-44 w-full place-items-center overflow-hidden rounded-[1.4rem] border-2 border-dashed border-primary/35 bg-secondary/60"
            >
              {proof ? (
                <img src={proof} alt="Foto-prova" className="h-full w-full object-cover" />
              ) : (
                <span className="flex flex-col items-center gap-2 px-6 text-center text-sm font-semibold text-secondary-foreground">
                  <span className="bg-brand grid h-12 w-12 place-items-center rounded-2xl text-white shadow-glow">
                    <Camera className="h-6 w-6" />
                  </span>
                  Tocca per scattare la foto
                  {mode === "find" ? "-prova del ritrovamento" : " del nuovo nascondiglio"}
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
                className={`flex items-start gap-2 rounded-2xl p-3 text-sm font-semibold ${
                  checking
                    ? "bg-muted text-muted-foreground"
                    : approved
                      ? "bg-moss/15 text-foreground"
                      : "bg-destructive/10 text-destructive"
                }`}
              >
                {checking ? (
                  <>
                    <ScanSearch className="mt-0.5 h-4 w-4 shrink-0 animate-pulse" /> Verifica AI
                    della foto in corso…
                  </>
                ) : (
                  verdict
                )}
              </div>
            )}

            {mode === "move" && (
              <>
                <textarea
                  value={clue}
                  onChange={(e) => setClue(e.target.value)}
                  rows={3}
                  placeholder="Nuovo indizio per il nuovo nascondiglio"
                  className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-base outline-none focus:border-ring focus:ring-4 focus:ring-ring/15"
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
                  setToken(undefined);
                }}
                className="press flex-1 rounded-2xl bg-muted py-3.5 text-sm font-extrabold text-muted-foreground"
              >
                Annulla
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void (mode === "find" ? confirmFind() : confirmMove())}
                className="press bg-brand flex-[1.4] rounded-2xl py-3.5 text-sm font-extrabold text-white shadow-glow disabled:opacity-60"
              >
                {busy
                  ? "Invio…"
                  : mode === "find"
                    ? "Conferma ritrovamento"
                    : "Conferma spostamento"}
              </button>
            </div>
          </div>
        )}

        {mode === "view" && (
          <div className="mt-5 space-y-2">
            {!found && !mine && !near && (
              <p className="flex items-center gap-2 rounded-2xl bg-muted px-4 py-3 text-sm font-semibold text-muted-foreground">
                <Navigation className="h-4 w-4 shrink-0 text-primary" />
                Avvicinati a meno di {FIND_RADIUS_M} m per registrare il ritrovamento.
              </p>
            )}
            <button
              type="button"
              onClick={() => setMode("find")}
              disabled={found || mine || !near}
              className="press bg-brand flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-extrabold text-white shadow-glow disabled:bg-none disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
            >
              {found ? (
                <>
                  <CheckCircle2 className="h-5 w-5" strokeWidth={2.6} /> Già trovato
                </>
              ) : mine ? (
                "È un tuo sasso"
              ) : (
                <>
                  <Camera className="h-5 w-5" strokeWidth={2.6} /> L'ho trovato! (con foto-prova)
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => setMode("move")}
              disabled={!canMove || !near}
              className="press flex w-full items-center justify-center gap-2 rounded-2xl bg-secondary py-4 text-base font-extrabold text-secondary-foreground disabled:opacity-50"
            >
              <Repeat2 className="h-5 w-5" strokeWidth={2.6} />
              {canMove ? "Sposta / nascondi di nuovo" : "Trovalo prima di spostarlo"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StatChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="flex items-center gap-2 rounded-2xl bg-muted px-3 py-2.5 text-foreground">
      <span className="text-primary">{icon}</span>
      <span className="truncate">{label}</span>
    </span>
  );
}

const DIFFICULTY_STYLE: Record<string, string> = {
  Facile: "bg-moss/15 text-[oklch(0.45_0.12_162)]",
  Medio: "bg-sun/25 text-[oklch(0.45_0.11_70)]",
  Difficile: "bg-paint/15 text-paint",
};

function DifficultyChip({ level }: { level: string }) {
  return (
    <span
      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-extrabold ${
        DIFFICULTY_STYLE[level] ?? "bg-secondary text-secondary-foreground"
      }`}
    >
      {level}
    </span>
  );
}
