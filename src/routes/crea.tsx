import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { createRock } from "@/lib/api";
import { clearDraft, enqueue, readDraft, saveDraft } from "@/lib/offline";
import { DEFAULT_POSITION, compressImage, getPrecisePosition } from "@/lib/rockdex";
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
  const { loading, userId, profile } = useSession();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState("");
  const [clue, setClue] = useState("");
  const [difficulty, setDifficulty] = useState<string>("Facile");
  const score = useServerFn(scoreRock);
  const [photo, setPhoto] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [approved, setApproved] = useState(false);
  const [verdict, setVerdict] = useState<string | null>(null);
  const [position, setPosition] = useState(DEFAULT_POSITION);
  const [hasFix, setHasFix] = useState(false);
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
      setDifficulty((LEVELS as readonly string[]).includes(draft.difficulty) ? draft.difficulty : "Difficile");
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
      return setError("La foto è obbligatoria: serve un'immagine chiara della faccia dipinta del sasso.");
    if (checking) return setError("Attendi la verifica AI della foto.");
    if (clue.trim().length < 10) return setError("Scrivi un indizio di almeno 10 caratteri.");
    if (!hasFix)
      return setError(
        "Posizione non confermata: premi “Aggiorna GPS” o sposta il pin sulla mappa dove hai nascosto il sasso.",
      );

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
    };

    setBusy(true);
    try {
      if (offline) {
        enqueue({ kind: "create", payload });
        setDone("📴 Sasso salvato offline: verrà pubblicato al ritorno del segnale.");
      } else {
        const id = await createRock(payload);
        setDone("🎉 Sasso nascosto! 🤖 L'AI sta valutando il nascondiglio…");
        try {
          const r = await score({ data: { rockId: id } });
          setDone(`🎉 Sasso nascosto! 🤖 L'AI gli ha assegnato ${r.points} punti: ${r.reason}`);
        } catch {
          setDone("🎉 Sasso nascosto! I punti verranno calcolati a breve.");
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
        <div className="mb-4 rounded-2xl bg-primary/10 p-4 text-sm font-semibold text-foreground">
          {done}
        </div>
      )}
      {draftFound && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-muted p-4 text-sm">
          <span className="text-muted-foreground">📝 Bozza recuperata automaticamente.</span>
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
            className="font-bold text-destructive"
          >
            Scarta
          </button>
        </div>
      )}

      <form onSubmit={submit} className="space-y-4">
        <div className="pebble-card p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Foto della faccia dipinta (obbligatoria)
          </p>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="mt-3 grid h-44 w-full place-items-center overflow-hidden rounded-2xl border-2 border-dashed border-border bg-muted"
          >
            {photo ? (
              <img src={photo} alt="Anteprima del sasso dipinto" className="h-full w-full object-cover" />
            ) : (
              <span className="px-6 text-center text-sm text-muted-foreground">
                📷 Tocca per caricare una foto nitida del sasso con la faccia o il disegno dipinto
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
              className={`mt-3 rounded-xl p-3 text-sm font-semibold ${
                checking
                  ? "bg-muted text-muted-foreground"
                  : approved
                    ? "bg-primary/10 text-foreground"
                    : "bg-destructive/10 text-destructive"
              }`}
            >
              {checking ? "🔍 Verifica AI della faccia dipinta in corso…" : verdict}
            </div>
          )}
        </div>

        <TextField label="Nome del sasso" value={name} onChange={setName} placeholder="es. Volpe Rossa" />

        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Indizio per trovarlo
          </span>
          <textarea
            value={clue}
            onChange={(e) => setClue(e.target.value)}
            rows={3}
            placeholder="es. Sotto la terza panchina del viale, tra le radici."
            className="w-full rounded-xl border border-input bg-background px-4 py-3 text-base outline-none focus:border-ring"
          />
        </label>

        <div>
          <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Difficoltà
          </span>
          <div className="grid grid-cols-3 gap-2">
            {LEVELS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDifficulty(d)}
                className={`rounded-xl py-2.5 text-sm font-bold ${
                  difficulty === d
                    ? "bg-primary text-primary-foreground shadow-pebble"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            🤖 Non scegli tu i punti: un'AI legge l'indizio e la difficoltà e assegna da 50 a 2.000 punti. Poi i voti e i commenti dei giocatori li fanno salire o scendere.
          </p>
        </div>

        <div className="pebble-card space-y-3 p-4 text-sm">
          <div className="flex items-center justify-between">
            <p className="font-bold">📍 Posizione precisa</p>
            <button type="button" onClick={() => void refreshGps()} className="font-bold text-primary">
              Aggiorna GPS
            </button>
          </div>
          <p className="text-muted-foreground">{gpsLabel}</p>
          <Suspense
            fallback={
              <div className="grid h-56 place-items-center rounded-2xl bg-muted text-sm text-muted-foreground">
                Caricamento mappa…
              </div>
            }
          >
            <LocationPicker value={position} onChange={pickPosition} />
          </Suspense>
          <p className="font-mono text-xs text-muted-foreground">
            {position.lat.toFixed(6)}, {position.lng.toFixed(6)}
          </p>
        </div>

        {error && <p className="text-sm font-semibold text-destructive">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-primary py-3.5 text-base font-bold text-primary-foreground shadow-pebble active:scale-[0.99] disabled:opacity-60"
        >
          {busy ? "Salvataggio…" : "Nascondi e registra il sasso"}
        </button>
      </form>
    </AppShell>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-input bg-background px-4 py-3 text-base outline-none focus:border-ring"
      />
    </label>
  );
}
