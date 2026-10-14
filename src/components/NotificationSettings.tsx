import { showNotification } from "@/lib/notify";
import { useEffect, useState } from "react";
import { toast } from "sonner";

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
    <section className="pebble-card mt-6 space-y-2 p-4">
      <h2 className="text-base font-bold">🔔 Avvisi</h2>
      {status === "granted" && (
        <>
          <p className="text-sm text-muted-foreground">
            Gli avvisi sono <strong>attivi</strong>: ti scrivo per le giornate a punti doppi, i sassi
            vicini e i messaggi dallo staff.
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
            className="w-full rounded-xl border border-border py-2.5 text-sm font-bold"
          >
            Mandami un avviso di prova
          </button>
        </>
      )}

      {status === "default" && (
        <>
          <p className="text-sm text-muted-foreground">
            Attiva gli avvisi per sapere quando c'è una giornata a punti doppi o un sasso vicino a te.
          </p>
          <button
            type="button"
            onClick={() => void enable()}
            className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground"
          >
            Attiva gli avvisi
          </button>
        </>
      )}

      {status === "denied" && (
        <p className="text-sm text-muted-foreground">
          Gli avvisi sono <strong>bloccati</strong>. Apri le impostazioni del sito nel browser (l'icona
          accanto all'indirizzo) e imposta le notifiche su "Consenti", poi torna qui.
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
            className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground"
          >
            Apri in una scheda nuova
          </button>
        </>
      )}

      {status === "unsupported" && (
        <p className="text-sm text-muted-foreground">
          Questo browser non supporta gli avvisi. Su iPhone aggiungi Ciao Rock alla schermata home per
          riceverli.
        </p>
      )}
    </section>
  );
}
