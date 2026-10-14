/** Mostra una notifica di sistema in modo compatibile con i telefoni (Android richiede il service worker). */
function inPreview() {
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  return /id-preview--|lovableproject\.com/.test(location.hostname);
}

let regPromise: Promise<ServiceWorkerRegistration | null> | null = null;

export function getNotifyRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || inPreview()) {
    return Promise.resolve(null);
  }
  if (!regPromise) {
    regPromise = navigator.serviceWorker
      .register("/notify-sw.js")
      .then(() => navigator.serviceWorker.ready)
      .catch(() => null);
  }
  return regPromise;
}

export async function showNotification(title: string, body: string): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission !== "granted") return false;
  const opts: NotificationOptions = { body, icon: "/icon-512.png", badge: "/favicon.png" };
  const reg = await getNotifyRegistration();
  if (reg) {
    try {
      await reg.showNotification(title, opts);
      return true;
    } catch {
      /* prova sotto */
    }
  }
  try {
    new Notification(title, opts);
    return true;
  } catch {
    return false;
  }
}
