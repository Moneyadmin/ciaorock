/** Regole di gioco condivise da app e server. */

/** Distanza massima (metri) dal sasso per registrarlo come trovato o per prenderlo e spostarlo. */
export const FIND_RADIUS_M = 75;

/**
 * Distanza massima (metri) tra dove sei e il nascondiglio quando crei o sposti un sasso.
 * Gli admin possono creare sassi ovunque.
 */
export const HIDE_RADIUS_M = 150;

export const DIFFICULTIES = ["Facile", "Medio", "Difficile"] as const;

/** Distanza in metri tra due coordinate (formula dell'emisenoverso). */
export function metersBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Admin: quanto tenere premuto un sasso sulla mappa prima che venga chiesto se spostarlo. */
export const ADMIN_HOLD_MS = 8000;

/** Toglie tag HTML e caratteri di controllo; massimo 500 caratteri (lo rifà anche il database). */
export function sanitizeBio(text: string) {
  return (
    text
      .replace(/<[^>]*>/g, "")
      // eslint-disable-next-line no-control-regex -- togliere i caratteri di controllo è proprio lo scopo
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
      .slice(0, 500)
      .trim()
  );
}
