import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CloudUpload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { adminMigratePhotos } from "@/lib/admin.functions";

/** Admin: sposta su Cloudflare R2 le foto ancora salvate in Supabase, a blocchi. */
export function PhotoMigration() {
  const migrate = useServerFn(adminMigratePhotos);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    let total = 0;
    try {
      for (;;) {
        const res = await migrate({});
        total += res.moved;
        setStatus(`Spostate ${total} foto · ne mancano ${res.remaining}`);
        if (res.done) {
          toast.success(`Fatto: ${total} foto spostate su R2`);
          setStatus(`Tutte le foto sono su R2 (${total} spostate ora).`);
          break;
        }
        if (res.moved === 0) {
          setStatus(`Restano ${res.remaining} foto che non si riescono a spostare.`);
          break;
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Spostamento non riuscito");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pebble-card space-y-2 p-4">
      <p className="flex items-center gap-2 font-bold">
        <CloudUpload className="h-4 w-4 text-primary" /> Foto su Cloudflare R2
      </p>
      <p className="text-xs text-muted-foreground">
        Sposta su R2 le foto dei sassi, le foto-prova, le segnalazioni e le foto profilo ancora
        salvate in Supabase, per non consumare la banda del piano gratuito. Si può rilanciare:
        sposta solo quelle che mancano. Tieni la pagina aperta finché non ha finito.
      </p>
      {status && <p className="text-sm font-semibold">{status}</p>}
      <button
        type="button"
        disabled={busy}
        onClick={() => void run()}
        className="press flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-extrabold text-primary-foreground disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {busy ? "Sposto le foto…" : "Sposta le foto su R2"}
      </button>
    </div>
  );
}
