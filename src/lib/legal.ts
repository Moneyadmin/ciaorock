/** Dati legali condivisi da informativa, termini e schermata di consenso. */

/** Cambiala quando informativa o termini cambiano in modo sostanziale: tutti dovranno riaccettare. */
export const TERMS_VERSION = "2026-10-21";

export const MIN_AGE = 14;

export const CONTROLLER = {
  name: "New Com Web S.r.l.s.",
  // TODO: completare con i dati della visura prima della pubblicazione
  address: "[sede legale]",
  vat: "[P. IVA]",
  email: "privacy@ciaorock.com",
};

/** Servizio che invia le email dell'app (SMTP configurato in Supabase). TODO: verificare. */
export const EMAIL_PROVIDER = "Cloudflare, Inc. (servizio di invio email)";
