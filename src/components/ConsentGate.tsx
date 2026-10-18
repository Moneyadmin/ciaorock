import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DeleteAccount } from "@/components/DeleteAccount";
import { MIN_AGE, TERMS_VERSION } from "@/lib/legal";

/**
 * Conferma dell'età minima e accettazione di termini e informativa. La data di nascita serve
 * solo al controllo e non viene salvata.
 */
export function ConsentGate({
  onDone,
  onSignOut,
  hasProfile,
}: {
  onDone: () => void | Promise<void>;
  onSignOut: () => void | Promise<void>;
  hasProfile: boolean;
}) {
  const [birth, setBirth] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tooYoung, setTooYoung] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { error: err } = await supabase.rpc("accept_terms", {
        _birth: birth,
        _version: TERMS_VERSION,
      });
      if (err) {
        const message = err.message.replace(/^.*?ERROR:\s*/, "");
        if (/almeno/.test(message)) setTooYoung(true);
        return setError(message);
      }
      await onDone();
    } finally {
      setBusy(false);
    }
  }

  if (tooYoung) {
    return (
      <div className="glass space-y-4 rounded-[2rem] p-5 text-center">
        <h2 className="text-2xl">Ci vediamo più avanti!</h2>
        <p className="text-sm text-muted-foreground">
          Ciao Rock è riservato a chi ha almeno {MIN_AGE} anni. Puoi comunque dipingere e nascondere
          sassi con i tuoi genitori o i tuoi amici più grandi.
        </p>
        {hasProfile && (
          <>
            <p className="text-xs text-muted-foreground">
              Avevi già un account: puoi eliminarlo qui, con tutti i tuoi dati.
            </p>
            <DeleteAccount />
          </>
        )}
        <button
          type="button"
          onClick={() => void onSignOut()}
          className="press w-full text-center text-sm font-extrabold text-muted-foreground"
        >
          Esci
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="glass relative space-y-4 rounded-[2rem] p-5">
      <div className="flex items-start gap-3">
        <span className="bg-brand grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-white shadow-glow">
          <ShieldCheck className="h-6 w-6" />
        </span>
        <div>
          <h2 className="text-2xl leading-tight">Prima di giocare</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ciao Rock è per chi ha almeno {MIN_AGE} anni. La data di nascita serve solo per questo
            controllo: non la salviamo.
          </p>
        </div>
      </div>
      <label className="block">
        <span className="mb-1.5 block text-sm font-bold">Data di nascita</span>
        <input
          type="date"
          required
          value={birth}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setBirth(e.target.value)}
          className="w-full rounded-2xl border border-input bg-card px-4 py-3 text-base outline-none focus:border-ring focus:ring-4 focus:ring-ring/15"
        />
      </label>
      <label className="flex items-start gap-2.5 text-sm">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--primary)]"
        />
        <span>
          Ho letto l'
          <Link to="/privacy" target="_blank" className="font-bold text-primary underline">
            informativa privacy
          </Link>{" "}
          e accetto i{" "}
          <Link to="/termini" target="_blank" className="font-bold text-primary underline">
            termini d'uso
          </Link>
          .
        </span>
      </label>
      {error && (
        <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy || !birth || !accepted}
        className="press bg-brand w-full rounded-2xl py-3.5 font-extrabold text-white shadow-glow disabled:opacity-50"
      >
        {busy ? "Un attimo…" : "Continua"}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => void onSignOut()}
        className="press w-full text-center text-sm font-extrabold text-muted-foreground"
      >
        Esci
      </button>
    </form>
  );
}
