import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { useState, type ReactNode } from "react";
import {
  CheckCircle2,
  Database,
  Download,
  FileText,
  KeyRound,
  Loader2,
  Mail,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import {
  IMPORT_TABLES,
  parseEmailList,
  type EmailEntry,
  type ImportTable,
} from "@/lib/legacy-source";
import { importAccounts, importRows, sendInvites, setupStatus } from "@/lib/setup.functions";

export const Route = createFileRoute("/setup")({
  head: () => ({
    meta: [{ title: "Setup — Ciao Rock" }, { name: "robots", content: "noindex" }],
  }),
  component: SetupPage,
});

type Row = Record<string, unknown>;
type Backup = Record<ImportTable, Row[]>;
type Status = Awaited<ReturnType<typeof setupStatus>>;

/** Colonne usate per ordinare la lettura a pagine (deve essere stabile). */
const ORDER: Record<ImportTable, string[]> = {
  profiles: ["id"],
  rocks: ["id"],
  finds: ["id"],
  rock_ratings: ["rock_id", "user_id"],
  double_days: ["id"],
  announcements: ["id"],
  user_roles: ["id"],
};
/** Le tabelle con le foto si leggono a pagine piccole. */
const PAGE: Partial<Record<ImportTable, number>> = { rocks: 25, finds: 25 };

const LABEL: Record<ImportTable, string> = {
  profiles: "Profili",
  rocks: "Sassi",
  finds: "Ritrovamenti",
  rock_ratings: "Voti",
  double_days: "Giornate speciali",
  announcements: "Avvisi",
  user_roles: "Ruoli admin",
};

function chunkBySize(rows: Row[], maxBytes = 2_500_000, maxRows = 500) {
  const chunks: Row[][] = [];
  let current: Row[] = [];
  let size = 0;
  for (const row of rows) {
    const bytes = JSON.stringify(row).length;
    if (current.length && (size + bytes > maxBytes || current.length >= maxRows)) {
      chunks.push(current);
      current = [];
      size = 0;
    }
    current.push(row);
    size += bytes;
  }
  if (current.length) chunks.push(current);
  return chunks;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function SetupPage() {
  const [secret, setSecret] = useState("");
  const [status, setStatus] = useState<Status | null>(null);
  const [legacyUrl, setLegacyUrl] = useState("");
  const [legacyKey, setLegacyKey] = useState("");
  const [legacyEmail, setLegacyEmail] = useState("");
  const [legacyPassword, setLegacyPassword] = useState("");
  const [backup, setBackup] = useState<Backup | null>(null);
  const [emails, setEmails] = useState<EmailEntry[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const say = (line: string) => setLog((l) => [...l, line]);

  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await task();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const refresh = () => setupStatus({ data: { secret } }).then(setStatus);

  /** 2. Legge tutte le tabelle dalla vecchia app con un account del vecchio gioco. */
  async function readLegacy() {
    const old = createClient(legacyUrl.trim(), legacyKey.trim(), {
      auth: { persistSession: false, autoRefreshToken: false, storageKey: "ciaorock-legacy" },
    });
    const { error: loginError } = await old.auth.signInWithPassword({
      email: legacyEmail.trim(),
      password: legacyPassword,
    });
    if (loginError) throw new Error(`Accesso alla vecchia app non riuscito: ${loginError.message}`);

    const result = {} as Backup;
    for (const table of IMPORT_TABLES) {
      const size = PAGE[table] ?? 1000;
      const rows: Row[] = [];
      for (let from = 0; ; from += size) {
        let query = old.from(table).select("*");
        for (const col of ORDER[table]) query = query.order(col);
        const { data, error: readError } = await query.range(from, from + size - 1);
        if (readError) throw new Error(`${LABEL[table]}: ${readError.message}`);
        rows.push(...(data as Row[]));
        say(`${LABEL[table]}: ${rows.length} righe lette…`);
        if (data.length < size) break;
      }
      result[table] = rows;
    }
    await old.auth.signOut();
    setBackup(result);
    say("Lettura completata.");
  }

  function downloadBackup() {
    if (!backup) return;
    const blob = new Blob([JSON.stringify(backup)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ciaorock-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  /** 4. Crea gli account e importa le tabelle nel nuovo database. */
  async function importAll() {
    if (!backup || !emails) return;
    const profileIds = backup.profiles.map((p) => String(p["id"]));
    const byId = new Map(emails.filter((e) => e.id).map((e) => [e.id!, e.email]));
    const accounts: { id: string | null; email: string | null }[] = profileIds.map((id) => ({
      id,
      email: byId.get(id) ?? null,
    }));
    const known = new Set(profileIds);
    for (const e of emails) {
      if (!e.id || !known.has(e.id)) accounts.push({ id: e.id, email: e.email });
    }

    let created = 0;
    let existing = 0;
    for (let i = 0; i < accounts.length; i += 25) {
      const res = await importAccounts({ data: { secret, accounts: accounts.slice(i, i + 25) } });
      created += res.created;
      existing += res.existing;
      res.errors.forEach((e) => say(`⚠ ${e}`));
      say(
        `Account: ${created} creati, ${existing} già presenti (${Math.min(i + 25, accounts.length)}/${accounts.length})`,
      );
    }

    for (const table of IMPORT_TABLES) {
      let inserted = 0;
      for (const rows of chunkBySize(backup[table])) {
        const res = await importRows({ data: { secret, table, rows } });
        inserted += res.inserted;
      }
      say(`${LABEL[table]}: ${inserted} importate (su ${backup[table].length})`);
    }
    await refresh();
    say("Importazione completata.");
  }

  /** 5. Invia le email a gruppi, aspettando quando Supabase segnala il limite di invii. */
  async function sendAll() {
    for (;;) {
      const res = await sendInvites({ data: { secret, max: 10 } });
      res.errors.forEach((e) => say(`⚠ ${e}`));
      if (res.sent) say(`Email inviate: +${res.sent}, ne restano ${res.remaining}`);
      if (res.remaining <= 0) break;
      if (res.rateLimited) {
        say(
          "Limite di invii di Supabase raggiunto: riprovo tra 60 secondi (puoi chiudere e riprendere più tardi).",
        );
        await sleep(60_000);
      } else if (!res.sent) {
        break;
      }
    }
    await refresh();
    say("Invio email terminato.");
  }

  const matched =
    backup && emails
      ? emails.filter((e) => e.id && backup.profiles.some((p) => p["id"] === e.id)).length
      : 0;

  return (
    <div className="mx-auto min-h-[100dvh] w-full max-w-xl px-5 py-10">
      <div className="flex items-center gap-3">
        <Logo className="h-12 w-12" />
        <div>
          <h1 className="text-3xl leading-none">Setup Ciao Rock</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Importa i dati della vecchia app e invita i giocatori.
          </p>
        </div>
      </div>

      {error && (
        <p className="mt-5 rounded-2xl bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">
          {error}
        </p>
      )}

      <Step
        n={1}
        icon={<KeyRound className="h-5 w-5" />}
        title="Codice di setup"
        done={Boolean(status)}
      >
        <p>
          Il valore di <code>SETUP_SECRET</code> impostato nel Worker.
        </p>
        <Input type="password" value={secret} onChange={setSecret} placeholder="SETUP_SECRET" />
        <Button disabled={busy || secret.length < 8} onClick={() => run(refresh)}>
          Continua
        </Button>
        {status && (
          <p className="font-semibold">
            Database nuovo: {status.users} account, {status.profiles} profili, {status.rocks} sassi
            · email inviate {status.invitesSent}, da inviare {status.invitesPending}
          </p>
        )}
      </Step>

      {status && (
        <Step
          n={2}
          icon={<Database className="h-5 w-5" />}
          title="Leggi i dati dalla vecchia app"
          done={Boolean(backup)}
        >
          <p>
            URL e chiave pubblicabile della vecchia app (nel vecchio <code>.env</code>:{" "}
            <code>VITE_SUPABASE_URL</code>, <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>) e il tuo
            account del vecchio gioco. Vengono usati solo in questa pagina.
          </p>
          <Input value={legacyUrl} onChange={setLegacyUrl} placeholder="https://….supabase.co" />
          <Input value={legacyKey} onChange={setLegacyKey} placeholder="sb_publishable_…" />
          <Input
            value={legacyEmail}
            onChange={setLegacyEmail}
            placeholder="email account vecchio gioco"
          />
          <Input
            type="password"
            value={legacyPassword}
            onChange={setLegacyPassword}
            placeholder="password"
          />
          <Button
            disabled={busy || !legacyUrl || !legacyKey || !legacyEmail || !legacyPassword}
            onClick={() => run(readLegacy)}
          >
            Leggi i dati
          </Button>
          {backup && (
            <>
              <ul className="grid grid-cols-2 gap-1 font-semibold">
                {IMPORT_TABLES.map((t) => (
                  <li key={t}>
                    {LABEL[t]}: {backup[t].length}
                  </li>
                ))}
              </ul>
              <Button variant="secondary" onClick={downloadBackup}>
                <Download className="h-4 w-4" /> Scarica una copia di backup (JSON)
              </Button>
              <p className="text-xs">
                Amicizie e messaggi non sono leggibili (ognuno vede solo i propri).
              </p>
            </>
          )}
        </Step>
      )}

      {backup && (
        <Step
          n={3}
          icon={<FileText className="h-5 w-5" />}
          title="Elenco email dei giocatori"
          done={Boolean(emails)}
        >
          <p>
            File <code>.txt</code> con una email per riga. Se accanto all'email c'è l'ID utente
            della vecchia app (es. <code>mario@x.it,1b2c3d4e-…</code>), l'account resta collegato al
            suo profilo, ai sassi e ai punti; senza ID il giocatore riparte con un profilo nuovo.
          </p>
          <label className="press flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/35 bg-secondary/60 py-4 font-extrabold text-secondary-foreground">
            <Upload className="h-5 w-5" /> Scegli il file .txt
            <input
              type="file"
              accept=".txt,text/plain,.csv"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) setEmails(parseEmailList(await file.text()));
              }}
            />
          </label>
          {emails && (
            <p className="font-semibold">
              {emails.length} email trovate · {matched} collegate a un profilo della vecchia app ·{" "}
              {backup.profiles.length - matched} profili senza email (restano nel gioco ma nessuno
              può accedervi)
            </p>
          )}
        </Step>
      )}

      {backup && emails && (
        <Step
          n={4}
          icon={<ShieldCheck className="h-5 w-5" />}
          title="Importa nel nuovo database"
          done={Boolean(status && status.profiles > 0)}
        >
          <p>
            Crea gli account e copia le tabelle. Si può ripetere: i dati già presenti vengono
            saltati.
          </p>
          <Button disabled={busy} onClick={() => run(importAll)}>
            Importa
          </Button>
        </Step>
      )}

      {status && status.users > 0 && (
        <Step
          n={5}
          icon={<Mail className="h-5 w-5" />}
          title="Invia l'annuncio ai giocatori"
          done={status.invitesPending === 0 && status.invitesSent > 0}
        >
          <p>
            Ogni giocatore riceve l'email "Ciao Rock è tornata" con il link per scegliere la nuova
            password. Serve l'SMTP personalizzato in Supabase (vedi README). Le email già inviate
            non vengono ripetute: puoi interrompere e riprendere.
          </p>
          <Button disabled={busy || status.invitesPending === 0} onClick={() => run(sendAll)}>
            Invia {status.invitesPending} email
          </Button>
        </Step>
      )}

      {(log.length > 0 || busy) && (
        <pre className="mt-6 max-h-72 overflow-auto rounded-2xl bg-ink p-4 text-xs leading-relaxed text-ink-foreground">
          {log.join("\n")}
          {busy && (
            <span className="mt-2 flex items-center gap-2 text-lime">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> in corso…
            </span>
          )}
        </pre>
      )}
    </div>
  );
}

function Step({
  n,
  icon,
  title,
  done,
  children,
}: {
  n: number;
  icon: ReactNode;
  title: string;
  done: boolean;
  children: ReactNode;
}) {
  return (
    <section className="pebble-card mt-5 space-y-3 rounded-[1.6rem] p-5 text-sm text-muted-foreground">
      <h2 className="flex items-center gap-2.5 text-xl text-foreground">
        <span
          className={`grid h-9 w-9 place-items-center rounded-xl ${done ? "bg-moss text-white" : "bg-secondary text-primary"}`}
        >
          {done ? <CheckCircle2 className="h-5 w-5" /> : icon}
        </span>
        {n}. {title}
      </h2>
      {children}
    </section>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      autoComplete="off"
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-2xl border border-input bg-card px-4 py-3 text-base text-foreground outline-none focus:border-ring focus:ring-4 focus:ring-ring/15"
    />
  );
}

function Button({
  children,
  onClick,
  disabled,
  variant = "primary",
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary";
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`press flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 font-extrabold disabled:opacity-50 ${
        variant === "primary" ? "bg-brand text-white shadow-glow" : "bg-muted text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
