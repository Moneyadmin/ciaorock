# Ciao Rock (RockDex)

Caccia ai sassi dipinti: si dipinge un sasso, lo si nasconde e gli altri lo trovano seguendo mappa e indizi.

- **App**: TanStack Start (React 19) + Tailwind 4, build Node standalone (`.output/`)
- **Dati e login**: Supabase (Postgres, Auth, Realtime)
- **Mappa**: Leaflet con base vettoriale [OpenFreeMap](https://openfreemap.org) (gratuita, senza chiave) via MapLibre
- **AI** (verifica foto, punteggio dei nascondigli): [OpenRouter](https://openrouter.ai)

## Regole di gioco (controllate dal server)

Il browser non scrive più direttamente ritrovamenti, nuovi sassi e spostamenti: passano dalle funzioni in
`src/lib/game.functions.ts`, che controllano tutto e poi scrivono con la service role.

| Azione | Controlli |
| --- | --- |
| Trovare un sasso | entro **75 m** dal sasso, non è un tuo sasso, foto-prova uguale alla foto del sasso (AI) |
| Spostare un sasso | averlo trovato (o creato), essere entro 75 m dal sasso, nuovo nascondiglio entro **150 m** da te, foto (AI) |
| Creare un sasso | foto di un sasso dipinto (AI), campi validi |

Le soglie sono in `src/lib/rules.ts`. La migrazione `supabase/migrations/20261015090000_regole_lato_server.sql`
blocca nel database le scritture dirette, protegge punti/ban/serie del profilo e sposta la posizione dal vivo
in `player_locations`, leggibile **solo dagli amici**.

> La posizione GPS la manda comunque il telefono: chi falsifica il GPS con app apposite può ancora barare
> sulla distanza. Il controllo ferma però chi bara dal browser o chiamando il database direttamente.

## Provarla in locale

Serve Node.js 22.

```sh
npm install
cp .env.example .env   # poi compila i valori (vedi sotto)
npm run dev            # http://localhost:3000
```

Altri comandi:

| Comando | Cosa fa |
| --- | --- |
| `npm run build` | build di produzione in `.output/` |
| `npm start` | avvia la build (`PORT`, `HOST` configurabili) |
| `npm run typecheck` | controllo TypeScript |
| `npm run lint` | ESLint + Prettier |

### Un database di prova

Le regole lato server richiedono la nuova migrazione, quindi per provare il gioco completo serve un progetto
Supabase **di test** (il piano gratuito basta). **Non applicare la migrazione al database Lovable** finché
l'app Lovable è online: la vecchia app smetterebbe di registrare ritrovamenti e sassi.

1. Crea un progetto su supabase.com e applica le migrazioni come descritto sotto.
2. *Authentication → Sign In / Providers → Email*: per i test disattiva **Confirm email**, così ti registri
   senza aspettare la mail.
3. Compila `.env` con URL e chiavi del progetto di test e con `OPENROUTER_API_KEY`.
4. `npm run dev`, registra **due account** (non puoi trovare un tuo sasso): per esempio uno sul computer e
   uno sul telefono.

### Simulare la posizione dal computer

In Chrome: DevTools (F12) → menu ⋮ → *More tools* → **Sensors** → *Location*, scegli *Other…* e inserisci
latitudine/longitudine. Così puoi "camminare" fino a un sasso senza muoverti.

### Provarla sul telefono

GPS e fotocamera funzionano solo su HTTPS, quindi l'indirizzo di rete del computer (`http://192.168…`) non
basta. Il modo più rapido è un tunnel gratuito:

```sh
npm run dev
npx cloudflared tunnel --url http://localhost:3000   # in un secondo terminale
```

Apri sul telefono l'indirizzo `https://….trycloudflare.com` che compare. Il tunnel resta attivo finché il
comando gira. In alternativa pubblica una versione di prova sulla VM OCI (sotto).

## Passare a un proprio progetto Supabase

1. Crea un progetto su [supabase.com](https://supabase.com) (regione EU, es. Francoforte).
2. Applica lo schema eseguendo **in quest'ordine** gli SQL nel *SQL Editor*:
   1. `supabase/migrations/2026081…` → `20260912…` (le migrazioni di Lovable, in ordine di data)
   2. `drizzle/migrations/0000…0003_*.sql`
   3. `supabase/migrations/20261015090000_regole_lato_server.sql` (regole lato server)

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
