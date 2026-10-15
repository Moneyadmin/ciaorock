/** Tabelle importate dalla vecchia app, nell'ordine giusto per i riferimenti tra tabelle. */
export const IMPORT_TABLES = [
  "profiles",
  "rocks",
  "finds",
  "rock_ratings",
  "double_days",
  "announcements",
  "user_roles",
] as const;
export type ImportTable = (typeof IMPORT_TABLES)[number];

/** Dominio fittizio per gli account dei vecchi giocatori di cui non abbiamo l'email. */
export const PLACEHOLDER_EMAIL_DOMAIN = "senza-email.ciaorock.invalid";

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const EMAIL = /[^\s,;<>"']+@[^\s,;<>"']+\.[^\s,;<>"']+/;

export type EmailEntry = { email: string; id: string | null };

/**
 * Legge l'elenco email: una per riga. Se nella riga c'è anche l'ID utente della vecchia app
 * (es. "mario@x.it,1b2c…" oppure "1b2c… mario@x.it"), l'account viene ricreato con lo stesso ID
 * e resta collegato a profilo, sassi e punti.
 */
export function parseEmailList(text: string): EmailEntry[] {
  const out = new Map<string, EmailEntry>();
  for (const line of text.split(/\r?\n/)) {
    const email = EMAIL.exec(line)?.[0]?.toLowerCase();
    if (!email || email.endsWith(PLACEHOLDER_EMAIL_DOMAIN)) continue;
    const id = UUID.exec(line)?.[0]?.toLowerCase() ?? null;
    out.set(email, { email, id });
  }
  return [...out.values()];
}
