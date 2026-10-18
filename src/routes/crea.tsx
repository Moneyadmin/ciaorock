import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Camera,
  CheckCircle2,
  Crosshair,
  FileText,
  Loader2,
  MapPin,
  PartyPopper,
  ScanSearch,
  WifiOff,
  ShieldAlert,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { createRock } from "@/lib/api";
import { announceRewards } from "@/lib/rewards";
import { clearDraft, enqueue, readDraft, saveDraft } from "@/lib/offline";
import { DEFAULT_POSITION, compressImage, distanceMeters, getPrecisePosition } from "@/lib/rockdex";
import { HIDE_RADIUS_M } from "@/lib/rules";
import { scoreRock } from "@/lib/points.functions";
const LEVELS = ["Facile", "Medio", "Difficile"] as const;
import { useSession } from "@/lib/useSession";
import { verifyRockPhoto } from "@/lib/vision.functions";

const LocationPicker = lazy(() => import("@/components/LocationPicker"));

export const Route = createFileRoute("/crea")({
  head: () => ({
    meta: [
      { title: "Crea e nascondi un sasso dipinto — RockDex" },
      {
        name: "description",
        content:
          "Registra il tuo sasso su RockDex: foto obbligatoria della faccia dipinta, indizio e posizione GPS precisa.",
      },
      { property: "og:title", content: "Crea un sasso dipinto — RockDex" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      {
        property: "og:description",
        content: "Carica la foto della faccia dipinta, scrivi l'indizio e nascondi il tuo sasso.",
      },
    ],
  }),
  component: CreatePage,
});

function CreatePage() {
  const { loading, userId, profile, admin } = useSession();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState("");
  const [clue, setClue] = useState("");
  const [difficulty, setDifficulty] = useState<string>("Facile");
  const score = useServerFn(scoreRock);
  const [photo, setPhoto] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [approved, setApproved] = useState(false);
  const [token, setToken] = useState<string | undefined>(undefined);
  const [verdict, setVerdict] = useState<string | null>(null);
  const [position, setPosition] = useState(DEFAULT_POSITION);
  const [hasFix, setHasFix] = useState(false);
  /** posizione GPS reale del telefono (il pin sulla mappa può essere spostato a mano) */
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsLabel, setGpsLabel] = useState("Rilevamento GPS di precisione in corso…");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draftFound, setDraftFound] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const checkPhoto = useServerFn(verifyRockPhoto);

  useEffect(() => {
    if (!loading && (!userId || !profile?.nickname)) navigate({ to: "/auth" });
  }, [loading, userId, profile, navigate]);

  // Restore an interrupted draft
  useEffect(() => {
    const draft = readDraft();
    if (draft) {
      setName(draft.name);
      setClue(draft.clue);
      setDifficulty(
        (LEVELS as readonly string[]).includes(draft.difficulty) ? draft.difficulty : "Difficile",
      );
      setPhoto(draft.photo);
      if (draft.lat != null && draft.lng != null) {
        setPosition({ lat: draft.lat, lng: draft.lng });
        setHasFix(true);
      }
      setDraftFound(true);
    }
    setHydrated(true);
  }, []);

  // Auto-save draft
  useEffect(() => {
    if (!hydrated) return;
    if (!name && !clue && !photo) return;
    const timer = setTimeout(
      () =>
        saveDraft({
          name,
          clue,
          difficulty,
          photo,
          lat: position.lat,
          lng: position.lng,
          savedAt: Date.now(),
        }),
      600,
    );
    return () => clearTimeout(timer);
  }, [hydrated, name, clue, difficulty, photo, position.lat, position.lng]);

  useEffect(() => {
    getPrecisePosition()
      .then((pos) => {
        setPosition({ lat: pos.lat, lng: pos.lng });
        setGps({ lat: pos.lat, lng: pos.lng });
        setHasFix(true);
        setGpsLabel(`GPS preciso: ±${pos.accuracy} m — sposta il pin per la posizione esatta`);
      })
      .catch(() =>
        setGpsLabel("GPS non disponibile: sposta il pin sulla mappa nel punto esatto del sasso"),
      );
  }, []);

  async function refreshGps() {
    setGpsLabel("Rilevamento GPS di precisione in corso…");
    try {
      const pos = await getPrecisePosition();
      setPosition({ lat: pos.lat, lng: pos.lng });
      setGps({ lat: pos.lat, lng: pos.lng });
      setHasFix(true);
      setGpsLabel(`GPS preciso: ±${pos.accuracy} m`);
    } catch {
      setGpsLabel("GPS non disponibile: sposta il pin sulla mappa nel punto esatto del sasso");
    }
  }

  function pickPosition(next: { lat: number; lng: number }) {
    setPosition(next);
    setHasFix(true);
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Carica un file immagine della faccia dipinta.");
      return;
    }
    const dataUrl = await compressImage(file);
    setPhoto(dataUrl);
    setApproved(false);
    setVerdict(null);
    setToken(undefined);
    setError(null);
    if (!navigator.onLine) {
      setVerdict("Offline: la verifica AI verrà fatta al ritorno del segnale.");
      return;
    }
    setChecking(true);
    try {
      const res = await checkPhoto({ data: { photo: dataUrl } });
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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 3) return setError("Dai un nome al tuo sasso (min. 3 caratteri).");
    if (!photo)
      return setError(
        "La foto è obbligatoria: serve un'immagine chiara della faccia dipinta del sasso.",
      );
    if (checking) return setError("Attendi la verifica AI della foto.");
    if (clue.trim().length < 10) return setError("Scrivi un indizio di almeno 10 caratteri.");
    if (!hasFix)
      return setError(
        "Posizione non confermata: premi “Aggiorna GPS” o sposta il pin sulla mappa dove hai nascosto il sasso.",
      );

    if (!admin) {
      if (!gps)
        return setError(
          "Serve il GPS per nascondere un sasso: attiva la posizione e premi “Aggiorna GPS”.",
        );
      if (distanceMeters(gps, position) > HIDE_RADIUS_M)
        return setError(
          `Il pin è troppo lontano da te: puoi nascondere un sasso solo dove ti trovi (entro ${HIDE_RADIUS_M} m).`,
        );
    }

    const offline = !navigator.onLine;
    if (!offline && !approved)
      return setError(
        "La verifica AI non ha riconosciuto una faccia o un disegno dipinto: carica la foto di un sasso dipinto.",
      );

    const payload = {
      name: name.trim(),
      clue: clue.trim(),
      photo,
      lat: position.lat,
      lng: position.lng,
      difficulty,
      ...(gps ? { fromLat: gps.lat, fromLng: gps.lng } : {}),
    };

    setBusy(true);
    try {
      if (offline) {
        enqueue({ kind: "create", payload });
        setDone("Sasso salvato offline: verrà pubblicato al ritorno del segnale.");
      } else {
        const id = await createRock({ ...payload, token });
        void announceRewards();
        setDone("Sasso nascosto! L'AI sta valutando il nascondiglio…");
        try {
          const r = await score({ data: { rockId: id } });
          setDone(`Sasso nascosto! L'AI gli ha assegnato ${r.points} punti: ${r.reason}`);
        } catch {
          setDone("Sasso nascosto! I punti verranno calcolati a breve.");
        }
      }
      clearDraft();
      setDraftFound(false);
      setName("");
      setClue("");
      setPhoto(null);
      setApproved(false);
      setVerdict(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Salvataggio non riuscito.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="Crea un sasso" subtitle="Solo sassi con faccia o disegno dipinto!">
      {done && (
        <div className="bg-brand mb-4 flex items-start gap-3 rounded-[1.4rem] p-4 text-sm font-bold text-white shadow-glow animate-in fade-in slide-in-from-top-2">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/20">
            {done.startsWith("Sasso salvato offline") ? (
              <WifiOff className="h-5 w-5" />
            ) : (
              <PartyPopper className="h-5 w-5" />
            )}
          </span>
          <span className="pt-0.5">{done}</span>
        </div>
      )}
      {draftFound && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-secondary p-3 pl-4 text-sm">
          <span className="inline-flex items-center gap-2 font-semibold text-secondary-foreground">
            <FileText className="h-4 w-4" /> Bozza recuperata automaticamente.
          </span>
          <button
            type="button"
            onClick={() => {
              clearDraft();
              setDraftFound(false);
              setName("");
              setClue("");
              setPhoto(null);
              setApproved(false);
              setVerdict(null);
            }}
            className="press rounded-xl bg-card px-3 py-1.5 font-extrabold text-destructive"
          >
            Scarta
          </button>
        </div>
      )}

      <form onSubmit={submit} className="space-y-5">
        <div>
          <StepLabel n={1} label="Foto della faccia dipinta (obbligatoria)" />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="press relative grid h-56 w-full place-items-center overflow-hidden rounded-[1.6rem] border-2 border-dashed border-primary/35 bg-secondary/60"
          >
            {photo ? (
              <>
                <img
                  src={photo}
                  alt="Anteprima del sasso dipinto"
                  className="h-full w-full object-cover"
                />
                <span className="glass absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-extrabold">
                  <Camera className="h-3.5 w-3.5" /> Cambia foto
                </span>
              </>
            ) : (
              <span className="flex flex-col items-center gap-3 px-8 text-center text-sm font-semibold text-secondary-foreground">
                <span className="bg-brand grid h-14 w-14 place-items-center rounded-2xl text-white shadow-glow">
                  <Camera className="h-7 w-7" />
                </span>
                Tocca per caricare una foto nitida del sasso con la faccia o il disegno dipinto
              </span>
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
          {(checking || verdict) && (
            <div
              className={`mt-3 flex items-start gap-2 rounded-2xl p-3 text-sm font-semibold ${
                checking
                  ? "bg-muted text-muted-foreground"
                  : approved
                    ? "bg-moss/15 text-foreground"
                    : "bg-destructive/10 text-destructive"
              }`}
            >
              {checking ? (
                <>
                  <ScanSearch className="mt-0.5 h-4 w-4 shrink-0 animate-pulse" /> Verifica AI della
                  faccia dipinta in corso…
                </>
              ) : (
                <>
                  {approved && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-moss" />}
                  {verdict}
                </>
              )}
            </div>
          )}
        </div>

        <TextField
          n={2}
          label="Nome del sasso"
          value={name}
          onChange={setName}
          placeholder="es. Volpe Rossa"
        />

        <label className="block">
          <StepLabel n={3} label="Indizio per trovarlo" />
          <textarea
            value={clue}
            onChange={(e) => setClue(e.target.value)}
            rows={3}
            placeholder="es. Sotto la terza panchina del viale, tra le radici."
            className="w-full rounded-2xl border border-input bg-card px-4 py-3.5 text-base shadow-pebble outline-none focus:border-ring focus:ring-4 focus:ring-ring/15"
          />
        </label>

        <div>
          <StepLabel n={4} label="Difficoltà" />
          <div className="grid grid-cols-3 gap-1 rounded-2xl bg-muted p-1">
            {LEVELS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDifficulty(d)}
                aria-pressed={difficulty === d}
                className={`press rounded-xl py-2.5 text-sm font-extrabold ${
                  difficulty === d
                    ? d === "Facile"
                      ? "bg-moss text-white shadow-pebble"
                      : d === "Medio"
                        ? "bg-sun text-ink shadow-pebble"
                        : "bg-paint text-white shadow-pebble"
                    : "text-muted-foreground"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
          <p className="mt-2.5 flex gap-2 rounded-2xl bg-secondary/70 p-3 text-xs font-medium text-secondary-foreground">
            <Bot className="h-4 w-4 shrink-0" />
            Non scegli tu i punti: un'AI legge l'indizio e la difficoltà e assegna da 50 a 2.000
            punti. Poi i voti e i commenti dei giocatori li fanno salire o scendere.
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <StepLabel n={5} label="Posizione precisa" />
            <button
              type="button"
              onClick={() => void refreshGps()}
              className="press -mt-1.5 inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-xs font-extrabold text-secondary-foreground"
            >
              <Crosshair className="h-3.5 w-3.5" /> Aggiorna GPS
            </button>
          </div>
          <div className="pebble-card space-y-2.5 rounded-[1.6rem] p-2 text-sm">
            <p className="flex items-start gap-2 px-2 pt-1 font-medium text-muted-foreground">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              {gpsLabel}
            </p>
            {admin ? (
              <p className="mx-2 rounded-xl bg-ink px-3 py-2 text-xs font-bold text-ink-foreground">
                Modalità admin: puoi mettere il sasso in qualunque punto della mappa.
              </p>
            ) : (
              gps &&
              distanceMeters(gps, position) > HIDE_RADIUS_M && (
                <p className="mx-2 rounded-xl bg-destructive/10 px-3 py-2 text-xs font-bold text-destructive">
                  Il pin è a {Math.round(distanceMeters(gps, position))} m da te: avvicinalo (max{" "}
                  {HIDE_RADIUS_M} m).
                </p>
              )
            )}
            <Suspense
              fallback={
                <div className="grid h-56 place-items-center rounded-2xl bg-muted text-sm font-semibold text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              }
            >
              <LocationPicker value={position} onChange={pickPosition} />
            </Suspense>
            <p className="px-2 pb-1 font-mono text-[11px] text-muted-foreground">
              {position.lat.toFixed(6)}, {position.lng.toFixed(6)}
            </p>
          </div>
        </div>

        <div className="flex gap-3 rounded-2xl bg-sun/25 px-4 py-3 text-xs leading-snug">
          <ShieldAlert className="h-5 w-5 shrink-0 text-ink" />
          <p>
            <strong>Per la tua sicurezza:</strong> chi trova il sasso vede la posizione esatta e il
            tuo nickname. Non nasconderlo vicino a casa tua o alla tua scuola, scegli solo luoghi
            pubblici e sicuri e non scrivere nell'indizio dati personali (nomi, indirizzi, scuole).
          </p>
        </div>

        {error && (
          <p className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="press bg-brand flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-extrabold text-white shadow-glow disabled:opacity-60"
        >
          {busy && <Loader2 className="h-5 w-5 animate-spin" />}
          {busy ? "Salvataggio…" : "Nascondi e registra il sasso"}
        </button>
      </form>
    </AppShell>
  );
}

function StepLabel({ n, label }: { n: number; label: string }) {
  return (
    <span className="mb-2 flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
      <span className="grid h-5 w-5 place-items-center rounded-full bg-ink text-[10px] text-lime">
        {n}
      </span>
      {label}
    </span>
  );
}

function TextField({
  n,
  label,
  value,
  onChange,
  placeholder,
}: {
  n: number;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <StepLabel n={n} label={label} />
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-input bg-card px-4 py-3.5 text-base shadow-pebble outline-none focus:border-ring focus:ring-4 focus:ring-ring/15"
      />
    </label>
  );
}
