# Ciao Rock (RockDex)

Caccia ai sassi dipinti: si dipinge un sasso, lo si nasconde e gli altri lo trovano seguendo mappa e indizi.

- **App**: TanStack Start (React 19) + Tailwind 4, build Node standalone (`.output/`)
- **Dati e login**: Supabase (Postgres, Auth, Realtime)
- **Mappa**: Leaflet con base vettoriale [OpenFreeMap](https://openfreemap.org) (gratuita, senza chiave) via MapLibre
- **AI** (verifica foto, punteggio dei nascondigli): [OpenRouter](https://openrouter.ai)

## Provarla in locale

Serve Node.js 22.

```sh
npm install
cp .env.example .env   # poi compila i valori (vedi sotto)
npm run dev            # http://localhost:3000
```

Per lavorare solo sulla grafica bastano le variabili `VITE_SUPABASE_*` e `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY`
(sono chiavi pubbliche). Senza `OPENROUTER_API_KEY` la verifica AI delle foto risponde "servizio non disponibile";
senza `SUPABASE_SERVICE_ROLE_KEY` i punti calcolati dall'AI non vengono salvati.

Altri comandi:

| Comando | Cosa fa |
| --- | --- |
| `npm run build` | build di produzione in `.output/` |
| `npm start` | avvia la build (`PORT`, `HOST` configurabili) |
| `npm run typecheck` | controllo TypeScript |
| `npm run lint` | ESLint + Prettier |

## Passare a un proprio progetto Supabase

1. Crea un progetto su [supabase.com](https://supabase.com) (regione EU, es. Francoforte).
2. Applica lo schema eseguendo **in quest'ordine** gli SQL nel *SQL Editor*:
   1. `supabase/migrations/*.sql` (in ordine di nome/data)
   2. `drizzle/migrations/0000…0003_*.sql`

   La migrazione `20260908054004_…` assegna il ruolo admin a un ID utente del vecchio progetto: dopo la
   registrazione del vostro account admin, aggiornalo con
   `insert into public.user_roles (user_id, role) values ('<id utente>', 'admin');`
3. *Authentication → URL Configuration*: imposta **Site URL** sul dominio di produzione e aggiungi
   `http://localhost:3000` tra i Redirect URL.
4. Copia URL, publishable key e service role key in `.env` (vedi `.env.example`).
5. Dati esistenti: esporta le tabelle da Lovable (Cloud → Database → Tables → Export CSV) e importale nello stesso
   ordine delle dipendenze: `profiles` → `rocks` → `finds`, `friendships`, `rock_ratings`, `messages`,
   `announcements`, `double_days`, `user_roles`. Le righe di `profiles` richiedono che gli utenti esistano già in
   `auth.users`: per portare anche gli account (con password) serve un dump del database chiesto al supporto
   Lovable; in alternativa gli utenti si registrano di nuovo.

> Le migrazioni nel repository sono quelle generate da Lovable. Prima di spegnere il vecchio progetto conviene
> confrontarle con lo schema reale (es. con un `pg_dump --schema-only`) per essere sicuri che non manchi nulla.

## Pubblicare su OCI (VM + Docker)

1. **VM**: Compute → Create instance, immagine *Ubuntu 24.04*, shape *VM.Standard.A1.Flex* (Ampere, rientra
   nell'Always Free) con 1–2 OCPU e 6–12 GB di RAM. Assegna un IP pubblico.
2. **Rete**: nella *Security List* della subnet apri in ingresso TCP 80 e 443 (e UDP 443 per HTTP/3).
   Le immagini Ubuntu di OCI hanno anche regole `iptables` locali che bloccano tutto: aprile con
   ```sh
   sudo iptables -I INPUT 6 -p tcp -m multiport --dports 80,443 -j ACCEPT
   sudo iptables -I INPUT 6 -p udp --dport 443 -j ACCEPT
   sudo netfilter-persistent save
   ```
3. **DNS**: crea un record `A` del dominio (es. `ciaorock.tuodominio.it`) verso l'IP pubblico della VM.
4. **Docker**:
   ```sh
   curl -fsSL https://get.docker.com | sudo sh
   sudo usermod -aG docker $USER   # poi esci e rientra
   ```
5. **Avvio**:
   ```sh
   git clone <url del repository> ciaorock && cd ciaorock
   cp .env.example .env && nano .env      # valori di produzione, incluso DOMAIN
   cd deploy && docker compose --env-file ../.env up -d --build
   ```
   Caddy ottiene da solo il certificato HTTPS per `DOMAIN`.
6. **Aggiornare**: `git pull && cd deploy && docker compose --env-file ../.env up -d --build`.

Le variabili `VITE_*` vengono inserite nel codice del browser al momento della build: se cambiano, va rifatta
l'immagine (`--build`).
