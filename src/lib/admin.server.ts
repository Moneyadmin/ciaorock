import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Password del pannello admin: sta solo nei segreti del Worker (ADMIN_PANEL_PASSWORD), mai nel
 * codice. È un secondo controllo: ogni funzione admin verifica comunque il ruolo nel database.
 */
export function checkAdminPassword(given: string): "ok" | "wrong" | "missing" {
  const expected = process.env["ADMIN_PANEL_PASSWORD"];
  if (!expected) return "missing";
  // confronto a tempo costante su hash di uguale lunghezza
  const a = createHash("sha256").update(given.trim()).digest();
  const b = createHash("sha256").update(expected.trim()).digest();
  return timingSafeEqual(a, b) ? "ok" : "wrong";
}
