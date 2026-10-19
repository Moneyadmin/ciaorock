import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/useSession";
import { KeyRound, Loader2, Mail } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ConsentGate } from "@/components/ConsentGate";
import { createProfile } from "@/lib/profile.functions";

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
  const {
    loading,
    userId,
    email: sessionEmail,
    profile,
    consented,
    refresh,
    signOut,
  } = useSession();
  const createProfileFn = useServerFn(createProfile);
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  /** accesso senza password: link o codice a 6 cifre via email */
  const [otp, setOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [code, setCode] = useState("");
  /** dopo una password sbagliata mostriamo subito il pulsante per reimpostarla */
  const [wrongPassword, setWrongPassword] = useState(false);

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
        const { error: err } = await supabase.auth.signInWithPassword({
          email: mail,
          password: pass,
        });
        if (err) {
          setWrongPassword(/invalid/i.test(err.message));
          setError(
            /not confirmed/i.test(err.message)
              ? "Devi ancora confermare l'email: apri il link che ti abbiamo mandato (controlla anche lo spam)."
              : err.message.toLowerCase().includes("invalid")
                ? "Email o password non corretti."
                : err.message,
          );
          return;
        }
      } else {
        if (pass.length < 6) return setError("La password deve avere almeno 6 caratteri.");
        const { data, error: err } = await supabase.auth.signUp({
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
        // Con la conferma email attiva non c'è ancora una sessione: va confermato il link.
        if (!data.session) {
          setInfo(
            `Ti abbiamo mandato un'email a ${mail}: apri il link per confermare l'account, poi torna qui e accedi. Controlla anche lo spam.`,
          );
          setMode("login");
          return;
        }
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function sendLoginEmail() {
    setError(null);
    setInfo(null);
    const mail = email.trim().toLowerCase();
    if (!mail) return setError("Scrivi la tua email.");
    setBusy(true);
    try {
      const { error: err } = await supabase.auth.signInWithOtp({
        email: mail,
        options: { emailRedirectTo: window.location.origin, shouldCreateUser: true },
      });
      if (err) {
        setError(
          /rate limit|seconds/i.test(err.message)
            ? "Hai già chiesto un'email da poco: aspetta un minuto e riprova."
            : err.message,
        );
        return;
      }
      setOtpSent(true);
      setInfo(
        `Ti abbiamo scritto a ${mail}: tocca il link nell'email oppure scrivi il codice a 6 cifre che trovi nel messaggio. Controlla anche lo spam.`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    setError(null);
    const token = code.replace(/\D/g, "");
    if (token.length !== 6) return setError("Il codice ha 6 cifre.");
    setBusy(true);
    try {
      const { error: err } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token,
        type: "email",
      });
      if (err) {
        setError(
          /expired|invalid/i.test(err.message)
            ? "Codice sbagliato o scaduto: controlla l'ultima email o chiedine uno nuovo."
            : err.message,
        );
        return;
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  function exitOtp() {
    setOtp(false);
    setOtpSent(false);
    setCode("");
    setError(null);
    setInfo(null);
  }

  async function forgotPassword() {
    setError(null);
    setInfo(null);
    const mail = email.trim().toLowerCase();
    if (!mail)
      return setError("Scrivi la tua email qui sopra, poi tocca di nuovo “Password dimenticata?”.");
    setBusy(true);
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(mail, {
        redirectTo: `${window.location.origin}/nuova-password`,
      });
      if (err) {
        setError(
          /rate limit|seconds/i.test(err.message)
            ? "Hai già chiesto un'email da poco: aspetta un minuto e riprova."
            : err.message,
        );
        return;
      }
      setWrongPassword(false);
      setInfo(
        `Se ${mail} è registrata, ti abbiamo mandato un'email con il link per scegliere una nuova password. Controlla anche lo spam.`,
      );
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
      const res = await createProfileFn({ data: { nickname: nick } });
      if (!res.ok) return setError(res.message);
      await refresh();
      navigate({ to: "/" });
    } catch {
      setError("Non sono riuscito a creare il profilo. Riprova.");
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

      {needsNickname && !consented ? (
        <ConsentGate hasProfile={false} onDone={refresh} onSignOut={signOut} />
      ) : needsNickname ? (
        <form onSubmit={saveNickname} className="glass relative space-y-4 rounded-[2rem] p-5">
          <div>
            <h2 className="text-2xl">Scegli il tuo nickname</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Sarà unico e visibile agli altri cercatori.
            </p>
          </div>
          <Field
            label="Nickname"
            value={nickname}
            onChange={setNickname}
            placeholder="es. SassoVolante"
          />
          {error && (
            <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
              {error}
            </p>
          )}
          <PrimaryButton disabled={busy}>Entra in RockDex</PrimaryButton>
          <button
            type="button"
            disabled={busy}
            onClick={() => void signOut()}
            className="press w-full text-center text-sm font-extrabold text-muted-foreground"
          >
            {sessionEmail ? `Non sei ${sessionEmail}? ` : ""}Esci e accedi con un altro account
          </button>
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
              onClick={() => {
                setMode("signup");
                exitOtp();
              }}
              className={`press flex-1 rounded-xl py-2.5 ${mode === "signup" ? "bg-ink text-ink-foreground shadow-pebble" : "text-muted-foreground"}`}
            >
              Registrati
            </button>
          </div>
          <Field
            label="Email"
            value={email}
            onChange={setEmail}
            type="email"
            placeholder="tu@email.it"
          />
          {mode === "login" && otp ? (
            <>
              {otpSent && (
                <Field
                  label="Codice dall'email"
                  value={code}
                  onChange={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
                  type="text"
                  placeholder="123456"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                />
              )}
              {error && (
                <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
                  {error}
                </p>
              )}
              {info && (
                <p className="rounded-xl bg-moss/15 px-3 py-2 text-sm font-semibold text-foreground">
                  {info}
                </p>
              )}
              {otpSent ? (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void verifyCode()}
                    className="press bg-brand flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-extrabold text-white shadow-glow disabled:opacity-60"
                  >
                    {busy && <Loader2 className="h-5 w-5 animate-spin" />} Entra
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void sendLoginEmail()}
                    className="press w-full text-center text-sm font-extrabold text-primary"
                  >
                    Mandami un'altra email
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void sendLoginEmail()}
                  className="press bg-brand flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-extrabold text-white shadow-glow disabled:opacity-60"
                >
                  {busy ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Mail className="h-5 w-5" />
                  )}
                  Mandami il link di accesso
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={exitOtp}
                className="press w-full text-center text-sm font-extrabold text-muted-foreground"
              >
                Accedi con la password
              </button>
            </>
          ) : (
            <>
              <Field
                label="Password"
                value={password}
                onChange={setPassword}
                type="password"
                placeholder="••••••"
              />
              {error && (
                <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
                  {error}
                </p>
              )}
              {mode === "login" && wrongPassword && !info && (
                <div className="space-y-2 rounded-2xl bg-secondary p-3">
                  <p className="text-sm font-semibold text-secondary-foreground">
                    Non ricordi la password, o giocavi alla vecchia Ciao Rock? Ti mandiamo un link
                    per sceglierne una nuova.
                  </p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void forgotPassword()}
                    className="press flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-extrabold text-primary-foreground"
                  >
                    <KeyRound className="h-4 w-4" /> Mandami il link per la nuova password
                  </button>
                </div>
              )}
              {info && (
                <p className="rounded-xl bg-moss/15 px-3 py-2 text-sm font-semibold text-foreground">
                  {info}
                </p>
              )}
              <PrimaryButton disabled={busy}>
                {mode === "login" ? "Accedi" : "Crea account"}
              </PrimaryButton>
              {mode === "login" && (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setOtp(true);
                      setError(null);
                      setInfo(null);
                    }}
                    className="press flex w-full items-center justify-center gap-2 rounded-2xl bg-secondary py-3.5 text-sm font-extrabold text-secondary-foreground"
                  >
                    <Mail className="h-4 w-4" /> Accedi senza password, con un link via email
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void forgotPassword()}
                    className="press w-full text-center text-sm font-extrabold text-primary"
                  >
                    Password dimenticata?
                  </button>
                </>
              )}
            </>
          )}
        </form>
      )}
      <p className="relative mt-5 text-center text-xs text-muted-foreground">
        Ciao Rock è per chi ha almeno 14 anni ·{" "}
        <Link to="/come-si-gioca" className="font-bold underline">
          Come si gioca
        </Link>{" "}
        ·{" "}
        <Link to="/privacy" className="font-bold underline">
          Privacy
        </Link>{" "}
        ·{" "}
        <Link to="/termini" className="font-bold underline">
          Termini
        </Link>
      </p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  inputMode,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  inputMode?: "numeric" | "email" | "text";
  autoComplete?: string;
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
        inputMode={inputMode}
        autoComplete={autoComplete}
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
