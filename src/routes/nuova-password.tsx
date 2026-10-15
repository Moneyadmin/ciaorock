import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/nuova-password")({
  head: () => ({
    meta: [{ title: "Nuova password — Ciao Rock" }, { name: "robots", content: "noindex" }],
  }),
  component: NewPasswordPage,
});

/**
 * Pagina aperta dal link dell'email "Password dimenticata" (o dall'annuncio della nuova
 * Ciao Rock): Supabase effettua l'accesso dal link e qui si sceglie la nuova password.
 */
function NewPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let done = false;
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        done = true;
        setReady(true);
      }
    });
    // Se il link non contiene una sessione valida (scaduto o già usato) lo diciamo dopo poco.
    const timer = setTimeout(async () => {
      if (done) return;
      const { data } = await supabase.auth.getSession();
      setReady(Boolean(data.session));
    }, 1500);
    return () => {
      clearTimeout(timer);
      sub.subscription.unsubscribe();
    };
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) return setError("La password deve avere almeno 6 caratteri.");
    if (password !== repeat) return setError("Le due password non coincidono.");
    setBusy(true);
    try {
      const { error: err } = await supabase.auth.updateUser({
        password,
        // l'account non è più "da migrare": le prossime email di recupero saranno quelle normali
        data: { migrated: false },
      });
      if (err) return setError(err.message);
      navigate({ to: "/" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-md flex-col justify-center overflow-hidden px-5 py-10">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary/25 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 top-40 h-72 w-72 rounded-full bg-paint/20 blur-3xl" />
      <div className="relative mb-8 text-center">
        <Logo className="mx-auto h-20 w-20 -rotate-6" />
        <h1 className="mt-5 text-4xl leading-none">Nuova password</h1>
        <p className="mx-auto mt-3 max-w-[19rem] text-[15px] font-medium text-muted-foreground">
          Scegli la password che userai per entrare in Ciao Rock.
        </p>
      </div>

      {ready === null && (
        <p className="glass relative flex items-center justify-center gap-2 rounded-[2rem] p-6 text-sm font-semibold text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Controllo il link…
        </p>
      )}

      {ready === false && (
        <div className="glass relative space-y-3 rounded-[2rem] p-6 text-center text-sm">
          <p className="font-semibold">Il link non è più valido (è scaduto o è già stato usato).</p>
          <button
            type="button"
            onClick={() => navigate({ to: "/auth" })}
            className="press bg-brand w-full rounded-2xl py-3.5 font-extrabold text-white shadow-glow"
          >
            Chiedine uno nuovo
          </button>
        </div>
      )}

      {ready && (
        <form onSubmit={save} className="glass relative space-y-4 rounded-[2rem] p-5">
          {[
            ["Nuova password", password, setPassword],
            ["Ripeti la password", repeat, setRepeat],
          ].map(([label, value, set]) => (
            <label key={label as string} className="block">
              <span className="mb-1.5 block pl-1 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                {label as string}
              </span>
              <input
                type="password"
                autoComplete="new-password"
                value={value as string}
                onChange={(e) => (set as (v: string) => void)(e.target.value)}
                className="w-full rounded-2xl border border-input bg-card px-4 py-3.5 text-base outline-none focus:border-ring focus:ring-4 focus:ring-ring/15"
              />
            </label>
          ))}
          {error && (
            <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="press bg-brand flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-extrabold text-white shadow-glow disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <KeyRound className="h-5 w-5" />}
            Salva e gioca
          </button>
        </form>
      )}
    </div>
  );
}
