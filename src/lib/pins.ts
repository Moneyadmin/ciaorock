/** Markup dei pin della mappa (HTML/SVG puro, usato dentro i divIcon di Leaflet). */

const PEBBLE =
  '<path d="M22 13.5c5.6 0 10 3.4 10 8.3 0 5.2-4.3 8.7-10.2 8.7-5.8 0-9.8-3.2-9.8-8.1 0-5.2 4.3-8.9 10-8.9Z" fill="#fff"/>';

/** Goccia con sasso dipinto (da trovare) o con spunta (già trovato). */
export function rockPinHtml({ found, dragging }: { found: boolean; dragging?: boolean }) {
  const id = found ? "g-found" : "g-rock";
  const [from, to] = found ? ["#3fd69a", "#17b37a"] : ["#7b5cff", "#ff4fa3"];
  const inner = found
    ? '<path d="M16.5 22.5l3.8 3.8 7.4-8" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>'
    : `${PEBBLE}<circle cx="18.5" cy="21" r="1.7" fill="#ff4fa3"/><circle cx="24.5" cy="19.2" r="1.5" fill="#7b5cff"/><circle cx="26" cy="24.6" r="1.6" fill="#ffc83d"/><path d="M17.5 25.6c1.7 1.3 3.6 1.4 5.2.6" fill="none" stroke="#2b2545" stroke-width="1.4" stroke-linecap="round"/>`;
  return `<div class="rock-pin${found ? " is-found" : ""}${dragging ? " is-dragging" : ""}"><svg viewBox="0 0 44 52" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><path d="M22 50c-1.2 0-2.2-.6-2.9-1.6C13.2 40.3 4 31.7 4 21.5 4 11.3 12 3 22 3s18 8.3 18 18.5c0 10.2-9.2 18.8-15.1 26.9-.7 1-1.7 1.6-2.9 1.6Z" fill="url(#${id})" stroke="#fff" stroke-width="3"/>${inner}</svg></div>`;
}

const AVATAR_GRADIENTS = [
  ["#7b5cff", "#b46bff"],
  ["#ff4fa3", "#ff8a5c"],
  ["#17b37a", "#3fd69a"],
  ["#2f8cff", "#5cc8ff"],
  ["#ff8a00", "#ffc83d"],
];

/** Gradiente stabile per un nickname: ogni amico ha sempre lo stesso colore. */
export function avatarGradient(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const [a, b] = AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length]!;
  return `linear-gradient(135deg, ${a}, ${b})`;
}

export function initialOf(name: string) {
  return (name.trim()[0] ?? "?").toUpperCase();
}
