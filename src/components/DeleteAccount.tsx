import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { deleteAccount } from "@/lib/profile.functions";

/** Cancellazione dell'account: chiede di scrivere ELIMINA per evitare tocchi per sbaglio. */
export function DeleteAccount({ compact = false }: { compact?: boolean }) {
  const remove = useServerFn(deleteAccount);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try {
      await remove({ data: { confirm: "ELIMINA" } });
      await supabase.auth.signOut({ scope: "local" });
      toast.success("Account eliminato. Ci mancherai!");
      navigate({ to: "/auth" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Cancellazione non riuscita");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`press inline-flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-extrabold text-destructive ${
          compact ? "" : "border border-destructive/30 bg-destructive/5"
        }`}
      >
        <Trash2 className="h-4 w-4" /> Elimina il mio account
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-[1.6rem] border border-destructive/30 bg-destructive/5 p-4 text-left">
      <p className="text-sm font-extrabold text-destructive">Eliminare l'account per sempre?</p>
      <p className="text-xs text-muted-foreground">
        Cancelliamo profilo, foto, ritrovamenti, messaggi, amicizie, punti e premi. I sassi che hai
        nascosto e che altri hanno già trovato restano nel gioco senza il tuo nome; gli altri
        vengono cancellati. Non si può annullare.
      </p>
      <label className="block text-xs font-bold">
        Scrivi ELIMINA per confermare
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoCapitalize="characters"
          className="mt-1 w-full rounded-2xl border border-input bg-card px-4 py-3 text-base outline-none focus:border-ring focus:ring-4 focus:ring-ring/15"
        />
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setText("");
          }}
          className="press flex-1 rounded-2xl bg-muted py-3 text-sm font-extrabold text-muted-foreground"
        >
          Annulla
        </button>
        <button
          type="button"
          disabled={text.trim().toUpperCase() !== "ELIMINA" || busy}
          onClick={() => void confirm()}
          className="press flex-1 rounded-2xl bg-destructive py-3 text-sm font-extrabold text-white disabled:opacity-50"
        >
          {busy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Elimina"}
        </button>
      </div>
    </div>
  );
}
