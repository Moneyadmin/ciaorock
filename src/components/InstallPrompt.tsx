import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const KEY = "ciaorock.install-prompt.v1";

/** Chiede una sola volta se aggiungere Ciao Rock alla schermata home (+ notifiche). */
export function InstallPrompt() {
  const [open, setOpen] = useState(false);
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosHelp, setIosHelp] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(KEY)) return;
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
      setOpen(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    const timer = setTimeout(() => setOpen(true), 2500);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      clearTimeout(timer);
    };
  }, []);

  function close() {
    localStorage.setItem(KEY, "done");
    setOpen(false);
  }

  async function accept() {
    if ("Notification" in window && Notification.permission === "default") {
      try {
        await Notification.requestPermission();
      } catch {
        /* il browser può rifiutare la richiesta: non è un problema */
      }
    }
    if (event) {
      await event.prompt();
      close();
      return;
    }
    setIosHelp(true);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-end bg-foreground/40 p-4">
      <div className="pebble-card w-full space-y-3 p-5">
        <p className="text-4xl">🪨</p>
        <h2 className="text-xl font-bold leading-tight">
          Vuoi aggiungere Ciao Rock alla schermata home?
        </h2>
        {iosHelp ? (
          <p className="text-sm text-muted-foreground">
            Sul tuo telefono si fa così: tocca il pulsante <strong>Condividi</strong> del browser, poi{" "}
            <strong>Aggiungi alla schermata Home</strong>. Ciao Rock si aprirà come una vera app.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Crei una scorciatoia sul telefono e attivi gli avvisi per le giornate a punti doppi e i
            sassi vicini a te.
          </p>
        )}
        <div className="flex gap-2 pt-1">
          {!iosHelp && (
            <button
              type="button"
              onClick={() => void accept()}
              className="flex-1 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground"
            >
              Sì, aggiungila
            </button>
          )}
          <button
            type="button"
            onClick={close}
            className="flex-1 rounded-xl border border-input px-4 py-3 text-sm font-bold"
          >
            {iosHelp ? "Ho capito" : "No, grazie"}
          </button>
        </div>
      </div>
    </div>
  );
}
