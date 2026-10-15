import { createServerFn } from "@tanstack/react-start";
import type { User } from "@supabase/supabase-js";
import type { Json } from "@/integrations/supabase/types";
import { z } from "zod";
import { IMPORT_TABLES, PLACEHOLDER_EMAIL_DOMAIN } from "./legacy-source";

/**
 * Funzioni della pagina /setup: importano i dati della vecchia app nel nuovo database e
 * mandano a ogni giocatore l'email per impostare la nuova password. Protette da SETUP_SECRET
 * (non da un login: al primo avvio nel database nuovo non esiste ancora nessun utente).
 */

const Secret = z.string().min(8).max(200);

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function guard(secret: string) {
  const { assertSetupSecret } = await import("./setup.server");
  assertSetupSecret(secret);
}

/** Tutti gli utenti del nuovo progetto (paginati). */
async function listAllUsers() {
  const db = await admin();
  const users: User[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    users.push(...data.users);
    if (data.users.length < 1000) return users;
  }
}

function needsInvite(u: { email?: string | undefined; user_metadata?: Record<string, unknown> }) {
  const meta = u.user_metadata ?? {};
  return (
    Boolean(u.email) &&
    !u.email!.endsWith(PLACEHOLDER_EMAIL_DOMAIN) &&
    meta["migrated"] === true &&
    !meta["invite_sent_at"]
  );
}

export const setupStatus = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ secret: Secret }).parse(d))
  .handler(async ({ data }) => {
    await guard(data.secret);
    const db = await admin();
    const [{ count: profiles }, { count: rocks }, users] = await Promise.all([
      db.from("profiles").select("id", { count: "exact", head: true }),
      db.from("rocks").select("id", { count: "exact", head: true }),
      listAllUsers(),
    ]);
    return {
      profiles: profiles ?? 0,
      rocks: rocks ?? 0,
      users: users.length,
      invitesPending: users.filter(needsInvite).length,
      invitesSent: users.filter((u) => Boolean(u.user_metadata?.["invite_sent_at"])).length,
    };
  });

const Account = z.object({
  id: z.string().uuid().nullable(),
  email: z.string().email().nullable(),
});

/**
 * Crea gli account: con lo stesso ID della vecchia app quando lo conosciamo, così profilo,
 * sassi e punti restano collegati. Senza email l'account riceve un indirizzo fittizio (nessuno
 * può accedervi, serve solo a tenere i dati). Gli account già esistenti vengono saltati.
 */
export const importAccounts = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ secret: Secret, accounts: z.array(Account).max(200) }).parse(d),
  )
  .handler(async ({ data }) => {
    await guard(data.secret);
    const db = await admin();
    let created = 0;
    let existing = 0;
    const errors: string[] = [];
    for (const a of data.accounts) {
      const email = a.email ?? `${a.id}@${PLACEHOLDER_EMAIL_DOMAIN}`;
      const { error } = await db.auth.admin.createUser({
        ...(a.id ? { id: a.id } : {}),
        email,
        email_confirm: true,
        user_metadata: a.email ? { migrated: true } : { migrated: true, placeholder: true },
      });
      if (!error) created++;
      else if (/already|exists|registered|duplicate/i.test(error.message)) existing++;
      else errors.push(`${a.email ?? a.id}: ${error.message}`);
    }
    return { created, existing, errors };
  });

export const importRows = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        secret: Secret,
        table: z.enum(IMPORT_TABLES),
        rows: z.array(z.record(z.string(), z.unknown())).max(2000),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await guard(data.secret);
    const db = await admin();
    const { data: inserted, error } = await db.rpc("admin_import", {
      _table: data.table,
      _rows: data.rows as Json,
    });
    if (error) throw new Error(`${data.table}: ${error.message}`);
    return { inserted: Number(inserted ?? 0) };
  });

/**
 * Manda l'email di recupero password (con l'annuncio della nuova Ciao Rock, vedi
 * supabase/email-templates) ai giocatori importati che non l'hanno ancora ricevuta.
 * Ne invia al massimo `max` per chiamata; se Supabase segnala il limite di invii si ferma.
 */
export const sendInvites = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ secret: Secret, max: z.number().int().min(1).max(20) }).parse(d),
  )
  .handler(async ({ data }) => {
    await guard(data.secret);
    const db = await admin();
    const site = process.env["PUBLIC_SITE_URL"] || "https://ciaorock.com";
    const pending = (await listAllUsers()).filter(needsInvite);
    let sent = 0;
    let rateLimited = false;
    const errors: string[] = [];
    for (const user of pending.slice(0, data.max)) {
      const { error } = await db.auth.resetPasswordForEmail(user.email!, {
        redirectTo: `${site}/nuova-password`,
      });
      if (error) {
        if (error.status === 429 || /rate limit/i.test(error.message)) {
          rateLimited = true;
          break;
        }
        errors.push(`${user.email}: ${error.message}`);
        continue;
      }
      await db.auth.admin.updateUserById(user.id, {
        user_metadata: { ...user.user_metadata, invite_sent_at: new Date().toISOString() },
      });
      sent++;
    }
    return { sent, remaining: pending.length - sent, rateLimited, errors };
  });
