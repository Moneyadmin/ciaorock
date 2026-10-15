import { timingSafeEqual } from "node:crypto";

/** La pagina /setup funziona solo se SETUP_SECRET è impostato e il codice inserito coincide. */
export function assertSetupSecret(given: string) {
  const expected = process.env["SETUP_SECRET"];
  if (!expected) throw new Error("Procedura disattivata: imposta SETUP_SECRET nel Worker.");
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error("Codice di setup errato.");
}
