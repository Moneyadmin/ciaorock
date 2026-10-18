import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Camera,
  Coins,
  Crown,
  Lightbulb,
  MapPin,
  Paintbrush,
  Repeat2,
  ShieldCheck,
  Sparkles,
  Star,
  Swords,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { Logo } from "./Logo";
import { rockPinHtml } from "@/lib/pins";

const KEY = "ciaorock.tutorial.v1";

function storageKey(userId: string) {
  return `${KEY}.${userId}`;
}

/** true se questo utente non ha ancora visto il tutorial su questo dispositivo. */
export function tutorialPending(userId: string) {
  try {
    return !localStorage.getItem(storageKey(userId));
  } catch {
    return false;
  }
}

function markSeen(userId: string) {
  try {
    localStorage.setItem(storageKey(userId), new Date().toISOString());
  } catch {
    /* storage non disponibile: il tutorial potrà ricomparire, non è un problema */
  }
}

type Step = { art: ReactNode; title: string; body: ReactNode };

function Tile({ children, className = "bg-brand" }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`grid h-20 w-20 place-items-center rounded-[1.6rem] text-white shadow-glow ${className}`}
    >
      {children}
    </span>
  );
}

function Point({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-left">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
        {icon}
      </span>
      <span className="pt-1 text-[15px] leading-snug">{children}</span>
    </li>
  );
}

function Pin({ found }: { found: boolean }) {
  return (
    <span className="inline-block" dangerouslySetInnerHTML={{ __html: rockPinHtml({ found }) }} />
  );
}

const STEPS: Step[] = [
  {
    art: <Logo className="h-24 w-24 -rotate-6 drop-shadow-[0_18px_30px_rgba(123,92,255,0.45)]" />,
    title: "Benvenuto in Ciao Rock!",
    body: (
      <p className="text-[15px] leading-relaxed text-muted-foreground">
        Una caccia al tesoro vera, per strada: c'è chi{" "}
        <strong className="text-foreground">dipinge</strong> un sasso e lo{" "}
        <strong className="text-foreground">nasconde</strong>, e chi lo{" "}
        <strong className="text-foreground">trova</strong> seguendo la mappa e gli indizi. Ti spiego
        tutto in 7 passi.
      </p>
    ),
  },
  {
    art: (
      <div className="flex items-end gap-3">
        <Pin found={false} />
        <Pin found />
        <span className="grid h-[46px] w-[46px] place-items-center rounded-full border-[3px] border-white bg-ink font-display text-lg text-lime shadow-lift">
          3
        </span>
      </div>
    ),
    title: "La mappa",
    body: (
      <ul className="space-y-3">
        <Point icon={<MapPin className="h-4 w-4" />}>
          Il pin <strong>viola</strong> è un sasso da trovare, quello <strong>verde</strong> l'hai
          già trovato.
        </Point>
        <Point icon={<Sparkles className="h-4 w-4" />}>
          Il cerchio col numero raggruppa più sassi vicini: avvicina la mappa per separarli.
        </Point>
        <Point icon={<Lightbulb className="h-4 w-4" />}>
          Tocca un sasso per vedere foto, indizio, distanza e punti.
        </Point>
      </ul>
    ),
  },
  {
    art: (
      <Tile>
        <Camera className="h-10 w-10" />
      </Tile>
    ),
    title: "Trovalo e scatta la foto",
    body: (
      <ul className="space-y-3">
        <Point icon={<MapPin className="h-4 w-4" />}>
          Vai sul posto e cerca il sasso seguendo l'indizio.
        </Point>
        <Point icon={<Camera className="h-4 w-4" />}>
          Quando lo trovi tocca <strong>"L'ho trovato!"</strong> e scatta la foto-prova: l'AI
          controlla che sia proprio quel sasso.
        </Point>
        <Point icon={<Star className="h-4 w-4" />}>
          Guadagni i suoi punti e voti quanto era difficile trovarlo.
        </Point>
      </ul>
    ),
  },
  {
    art: (
      <Tile className="bg-gradient-to-br from-paint to-[#ff8a5c]">
        <Paintbrush className="h-10 w-10" />
      </Tile>
    ),
    title: "Crea il tuo sasso",
    body: (
      <ul className="space-y-3">
        <Point icon={<Paintbrush className="h-4 w-4" />}>
          Dipingi una faccia o un disegno su un sasso, poi tocca il <strong>+</strong> in basso.
        </Point>
        <Point icon={<Lightbulb className="h-4 w-4" />}>
          Nascondilo dove ti trovi e aggiungi foto, nome, un indizio e la posizione esatta.
        </Point>
        <Point icon={<Zap className="h-4 w-4" />}>
          L'AI legge l'indizio e decide quanti punti vale: da 50 a 2.000. Più è difficile, più vale.
        </Point>
      </ul>
    ),
  },
  {
    art: (
      <Tile className="bg-gradient-to-br from-sky to-primary">
        <Repeat2 className="h-10 w-10" />
      </Tile>
    ),
    title: "Fai viaggiare i sassi",
    body: (
      <p className="text-[15px] leading-relaxed text-muted-foreground">
        Puoi prendere un sasso e{" "}
        <strong className="text-foreground">nasconderlo da un'altra parte</strong> con un nuovo
        indizio e una nuova foto. Così ogni sasso gira la città (e magari il mondo!).
      </p>
    ),
  },
  {
    art: (
      <div className="flex gap-2">
        <Tile className="h-16 w-16 bg-gradient-to-br from-sun to-[#ff9f5c]">
          <Award className="h-8 w-8" />
        </Tile>
        <Tile className="h-16 w-16">
          <Trophy className="h-8 w-8" />
        </Tile>
        <Tile className="h-16 w-16 bg-gradient-to-br from-moss to-sky">
          <Users className="h-8 w-8" />
        </Tile>
      </div>
    ),
    title: "Badge, classifica e amici",
    body: (
      <ul className="space-y-3">
        <Point icon={<Award className="h-4 w-4" />}>
          Nel <strong>RockDex</strong> trovi la tua collezione e più di 50 traguardi da sbloccare.
        </Point>
        <Point icon={<Zap className="h-4 w-4" />}>
          Nelle <strong>giornate speciali</strong> i punti valgono doppio: tieni gli avvisi attivi!
        </Point>
        <Point icon={<Users className="h-4 w-4" />}>
          Aggiungi gli amici per scrivergli e sfidarli nelle missioni co-op.
        </Point>
      </ul>
    ),
  },
  {
    art: (
      <div className="flex gap-2">
        <Tile className="h-16 w-16 bg-gradient-to-br from-sun to-[#ff9f5c]">
          <Coins className="h-8 w-8" />
        </Tile>
        <Tile className="h-16 w-16 bg-gradient-to-br from-ink to-primary">
          <Swords className="h-8 w-8" />
        </Tile>
      </div>
    ),
    title: "Punti extra e negozio",
    body: (
      <ul className="space-y-3">
        <Point icon={<Coins className="h-4 w-4" />}>
          Ogni giorno, al primo accesso, ricevi <strong>15 punti</strong> bonus.
        </Point>
        <Point icon={<Paintbrush className="h-4 w-4" />}>
          Quando qualcuno trova un <strong>tuo</strong> sasso, ricevi metà dei suoi punti.
        </Point>
        <Point icon={<Swords className="h-4 w-4" />}>
          Sfida un amico a una <strong>Missione Co-op</strong>: 30 minuti per trovare lo stesso
          sasso, e i punti valgono ×2.
        </Point>
        <Point icon={<Crown className="h-4 w-4" />}>
          Nel <strong>negozio</strong> spendi il saldo per le targhette dorate (la classifica non
          scende).
        </Point>
      </ul>
    ),
  },
  {
    art: (
      <Tile className="bg-gradient-to-br from-moss to-[#17b37a]">
        <ShieldCheck className="h-10 w-10" />
      </Tile>
    ),
    title: "Gioca in sicurezza",
    body: (
      <ul className="space-y-2.5 text-left text-[15px] leading-snug">
        <li>• Esplora posti pubblici e sicuri, meglio se con amici o un adulto.</li>
        <li>• Non entrare in proprietà private e non nascondere sassi in punti pericolosi.</li>
        <li>• Guarda dove cammini, non lo schermo, quando attraversi la strada.</li>
        <li>• Non condividere indirizzo, scuola o numero di telefono in chat.</li>
      </ul>
    ),
  },
];

/** Tutorial a schede mostrato al primo accesso (e riapribile dal RockDex). */
export function Tutorial({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const touchX = useRef<number | null>(null);
  const last = index === STEPS.length - 1;
  const step = STEPS[index]!;

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  function close() {
    markSeen(userId);
    onClose();
  }

  const go = (delta: number) => setIndex((i) => Math.min(STEPS.length - 1, Math.max(0, i + delta)));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-title"
      className="fixed inset-0 z-[1100] flex flex-col bg-background animate-in fade-in"
      onTouchStart={(e) => {
        touchX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const start = touchX.current;
        const end = e.changedTouches[0]?.clientX;
        touchX.current = null;
        if (start == null || end == null || Math.abs(end - start) < 50) return;
        go(end < start ? 1 : -1);
      }}
    >
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 top-1/3 h-72 w-72 rounded-full bg-paint/15 blur-3xl" />

      <div className="relative mx-auto flex w-full max-w-md items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="flex gap-1.5" aria-label={`Passo ${index + 1} di ${STEPS.length}`}>
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-2 rounded-full transition-all ${
                i === index ? "w-7 bg-primary" : i < index ? "w-2 bg-primary/40" : "w-2 bg-border"
              }`}
            />
          ))}
        </div>
        {!last && (
          <button
            type="button"
            onClick={close}
            className="press rounded-full px-3 py-1.5 text-sm font-extrabold text-muted-foreground"
          >
            Salta
          </button>
        )}
      </div>

      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center overflow-y-auto px-6 text-center">
        <div
          key={index}
          className="flex w-full flex-col items-center animate-in fade-in slide-in-from-right-4 duration-300"
        >
          <div className="grid h-28 place-items-center">{step.art}</div>
          <h2 id="tutorial-title" className="mt-6 text-[2rem] leading-tight">
            {step.title}
          </h2>
          <div className="mt-4 w-full">{step.body}</div>
        </div>
      </div>

      <div className="relative mx-auto flex w-full max-w-md gap-2 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
        {index > 0 && (
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Indietro"
            className="press grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-muted text-muted-foreground"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={2.6} />
          </button>
        )}
        <button
          type="button"
          onClick={() => (last ? close() : go(1))}
          className="press bg-brand flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl text-base font-extrabold text-white shadow-glow"
        >
          {last ? "Inizia a giocare!" : index === 0 ? "Iniziamo" : "Avanti"}
          {!last && <ArrowRight className="h-5 w-5" strokeWidth={2.6} />}
        </button>
      </div>
    </div>
  );
}
