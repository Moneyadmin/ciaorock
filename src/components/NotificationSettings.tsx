import { showNotification } from "@/lib/notify";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, BellOff, BellRing } from "lucide-react";

type Status = "unsupported" | "default" | "granted" | "denied" | "iframe";

/** Pulsante esplicito per attivare gli avvisi (giornate speciali, sassi vicini, messaggi). */
export function NotificationSettings() {
  const [status, setStatus] = useState<Status>("default");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) {
      setStatus("unsupported");
      return;
    }
    if (window.top !== window.self && Notification.permission === "default") {
      setStatus("iframe");
      return;
    }
    setStatus(Notification.permission as Status);
  }, []);

  async function enable() {
    if (!("Notification" in window)) {
      setStatus("unsupported");
      return;
    }
    if (window.top !== window.self) {
      setStatus("iframe");
      return;
    }
    try {
      const result = await Notification.requestPermission();
      setStatus(result as Status);
      if (result === "granted") {
        await showNotification(
          "Avvisi attivi! 🎉",
          "Ti avviserò per le giornate a punti doppi, i sassi vicini e i messaggi.",
        );
      } else {
        toast.error("Avvisi non attivati.");
      }
    } catch {
      toast.error("Il browser ha bloccato la richiesta.");
    }
  }

  return (
    <section className="pebble-card space-y-3 rounded-[1.4rem] p-4">
      <div className="flex items-center gap-2.5">
        <span
          className={`grid h-9 w-9 place-items-center rounded-xl ${
            status === "granted"
              ? "bg-moss/15 text-[oklch(0.45_0.12_162)]"
              : status === "denied" || status === "unsupported"
                ? "bg-muted text-muted-foreground"
                : "bg-secondary text-primary"
          }`}
        >
          {status === "granted" ? (
            <BellRing className="h-5 w-5" />
          ) : status === "denied" || status === "unsupported" ? (
            <BellOff className="h-5 w-5" />
          ) : (
            <Bell className="h-5 w-5" />
          )}
        </span>
        <h2 className="text-lg">Avvisi</h2>
      </div>
      {status === "granted" && (
        <>
          <p className="text-sm text-muted-foreground">
            Gli avvisi sono <strong>attivi</strong>: ti scrivo per le giornate a punti doppi, i
            sassi vicini e i messaggi dallo staff.
          </p>
          <button
            type="button"
            onClick={async () => {
              const ok = await showNotification(
                "Prova avviso 🪨",
                "Se leggi questo messaggio, funziona tutto!",
              );
              if (!ok) toast.error("Il telefono non ha mostrato l'avviso.");
            }}
            className="press w-full rounded-2xl bg-muted py-3 text-sm font-extrabold"
          >
            Mandami un avviso di prova
          </button>
        </>
      )}

      {status === "default" && (
        <>
          <p className="text-sm text-muted-foreground">
            Attiva gli avvisi per sapere quando c'è una giornata a punti doppi o un sasso vicino a
            te.
          </p>
          <button
            type="button"
            onClick={() => void enable()}
            className="press bg-brand w-full rounded-2xl py-3 text-sm font-extrabold text-white shadow-glow"
          >
            Attiva gli avvisi
          </button>
        </>
      )}

      {status === "denied" && (
        <p className="text-sm text-muted-foreground">
          Gli avvisi sono <strong>bloccati</strong>. Apri le impostazioni del sito nel browser
          (l'icona accanto all'indirizzo) e imposta le notifiche su "Consenti", poi torna qui.
        </p>
      )}

      {status === "iframe" && (
        <>
          <p className="text-sm text-muted-foreground">
            Qui dentro il browser non permette di attivare gli avvisi. Apri Ciao Rock in una scheda
            normale (o dall'icona sulla schermata home) e riprova da questo pulsante.
          </p>
          <button
            type="button"
            onClick={() => window.open(window.location.href, "_blank", "noopener")}
            className="press bg-brand w-full rounded-2xl py-3 text-sm font-extrabold text-white shadow-glow"
          >
            Apri in una scheda nuova
          </button>
        </>
      )}

      {status === "unsupported" && (
        <p className="text-sm text-muted-foreground">
          Questo browser non supporta gli avvisi. Su iPhone aggiungi Ciao Rock alla schermata home
          per riceverli.
        </p>
      )}
    </section>
  );
}
