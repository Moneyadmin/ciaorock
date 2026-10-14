import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/useSession";
import { Loader2 } from "lucide-react";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Accedi a RockDex — Caccia ai sassi dipinti" },
      {
        name: "description",
        content:
          "Entra in RockDex: crea il tuo account, scegli un nickname e inizia a cercare sassi dipinti nascosti vicino a te.",
      },
      { property: "og:title", content: "Accedi a RockDex" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      {
        property: "og:description",
        content: "Crea il tuo account RockDex e inizia la caccia ai sassi dipinti.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { loading, userId, profile, refresh } = useSession();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && userId && profile?.nickname) navigate({ to: "/" });
  }, [loading, userId, profile, navigate]);

  const needsNickname = Boolean(userId && !profile);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const mail = email.trim().toLowerCase();
    const pass = password.trim();
    if (!mail || !pass) return setError("Inserisci email e password.");
    setBusy(true);
    try {
      if (mode === "login") {
        const { error: err } = await supabase.auth.signInWithPassword({ email: mail, password: pass });
        if (err) {
          setError(
            err.message.toLowerCase().includes("invalid")
              ? "Email o password non corretti. Se non hai un account tocca “Registrati”."
              : err.message,
          );
          return;
        }
      } else {
        if (pass.length < 6) return setError("La password deve avere almeno 6 caratteri.");
        const { error: err } = await supabase.auth.signUp({
          email: mail,
          password: pass,
          options: { emailRedirectTo: window.location.origin },
        });
        if (err) {
          setError(
            err.message.toLowerCase().includes("already")
              ? "Esiste già un account con questa email: tocca “Accedi”."
              : err.message,
          );
          return;
        }
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function saveNickname(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const nick = nickname.trim();
    if (nick.length < 3) return setError("Il nickname deve avere almeno 3 caratteri.");
    if (!userId) return setError("Sessione scaduta: accedi di nuovo.");
    setBusy(true);
    try {
      const { data: taken } = await supabase
        .from("profiles")
        .select("id")
        .ilike("nickname", nick)
        .maybeSingle();
      if (taken) return setError("Nickname già in uso, scegline un altro.");

      const { error: err } = await supabase.from("profiles").insert({ id: userId, nickname: nick });
      if (err) return setError("Nickname già in uso o non valido, riprova.");
      await refresh();
      navigate({ to: "/" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-md flex-col justify-center overflow-hidden px-5 py-10">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary/25 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 top-40 h-72 w-72 rounded-full bg-paint/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 left-10 h-60 w-60 rounded-full bg-lime/30 blur-3xl" />
      <div className="relative mb-8 text-center">
        <Logo className="mx-auto h-24 w-24 -rotate-6 drop-shadow-[0_18px_30px_rgba(123,92,255,0.45)]" />
        <h1 className="mt-6 text-5xl leading-none">
          Ciao <span className="text-brand">Rock</span>
        </h1>
        <p className="mx-auto mt-3 max-w-[18rem] text-[15px] font-medium text-muted-foreground">
          Dipingi, nascondi e trova sassi in giro per il mondo.
        </p>
      </div>

      {needsNickname ? (
        <form onSubmit={saveNickname} className="glass relative space-y-4 rounded-[2rem] p-5">
          <div>
            <h2 className="text-2xl">Scegli il tuo nickname</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Sarà unico e visibile agli altri cercatori.
            </p>
          </div>
          <Field label="Nickname" value={nickname} onChange={setNickname} placeholder="es. SassoVolante" />
          {error && <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">{error}</p>}
          <PrimaryButton disabled={busy}>Entra in RockDex</PrimaryButton>
        </form>
      ) : (
        <form onSubmit={submit} className="glass relative space-y-4 rounded-[2rem] p-5">
          <div className="flex rounded-2xl bg-muted p-1 text-sm font-extrabold">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`press flex-1 rounded-xl py-2.5 ${mode === "login" ? "bg-ink text-ink-foreground shadow-pebble" : "text-muted-foreground"}`}
            >
              Accedi
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`press flex-1 rounded-xl py-2.5 ${mode === "signup" ? "bg-ink text-ink-foreground shadow-pebble" : "text-muted-foreground"}`}
            >
              Registrati
            </button>
          </div>
          <Field label="Email" value={email} onChange={setEmail} type="email" placeholder="tu@email.it" />
          <Field
            label="Password"
            value={password}
            onChange={setPassword}
            type="password"
            placeholder="••••••"
          />
          {error && <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">{error}</p>}
          <PrimaryButton disabled={busy}>{mode === "login" ? "Accedi" : "Crea account"}</PrimaryButton>
        </form>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block pl-1 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-input bg-card px-4 py-3.5 text-base text-foreground outline-none focus:border-ring focus:ring-4 focus:ring-ring/15"
      />
    </label>
  );
}

function PrimaryButton({ children, disabled }: { children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="press bg-brand flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-extrabold text-white shadow-glow disabled:opacity-60"
    >
      {disabled && <Loader2 className="h-5 w-5 animate-spin" />}
      {children}
    </button>
  );
}
