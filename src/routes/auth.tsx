import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/useSession";

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
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-8 text-center">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-secondary text-4xl shadow-pebble">
          🪨
        </div>
        <h1 className="mt-4 text-4xl font-bold text-foreground">RockDex</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Dipingi, nascondi e trova sassi in giro per il mondo.
        </p>
      </div>

      {needsNickname ? (
        <form onSubmit={saveNickname} className="pebble-card space-y-4 p-5">
          <div>
            <h2 className="text-xl font-bold">Scegli il tuo nickname</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Sarà unico e visibile agli altri cercatori.
            </p>
          </div>
          <Field label="Nickname" value={nickname} onChange={setNickname} placeholder="es. SassoVolante" />
          {error && <p className="text-sm font-semibold text-destructive">{error}</p>}
          <PrimaryButton disabled={busy}>Entra in RockDex</PrimaryButton>
        </form>
      ) : (
        <form onSubmit={submit} className="pebble-card space-y-4 p-5">
          <div className="flex rounded-xl bg-muted p-1 text-sm font-bold">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`flex-1 rounded-lg py-2 ${mode === "login" ? "bg-card text-foreground shadow-pebble" : "text-muted-foreground"}`}
            >
              Accedi
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`flex-1 rounded-lg py-2 ${mode === "signup" ? "bg-card text-foreground shadow-pebble" : "text-muted-foreground"}`}
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
          {error && <p className="text-sm font-semibold text-destructive">{error}</p>}
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
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-input bg-background px-4 py-3 text-base text-foreground outline-none focus:border-ring"
      />
    </label>
  );
}

function PrimaryButton({ children, disabled }: { children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="w-full rounded-xl bg-primary py-3 text-base font-bold text-primary-foreground shadow-pebble active:scale-[0.99] disabled:opacity-60"
    >
      {children}
    </button>
  );
}
