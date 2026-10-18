# Test

- `rls-test.sql`: verifica le regole del database (chi può scrivere cosa, visibilità della posizione).
  Si esegue su un Postgres di prova dopo aver applicato tutte le migrazioni e simulato lo schema `auth`
  di Supabase (ruoli `anon`/`authenticated`/`service_role`, `auth.uid()`, `auth.role()`, `auth.users`).
  **Non eseguirlo su un database reale**: inserisce utenti e dati finti.
- `import-test.sql`: verifica la funzione `admin_import` usata dalla pagina /setup (punti storici conservati,
  coordinate dei ritrovamenti rimosse, reimportazione senza doppioni, vietata ai giocatori). Stesse
  avvertenze: solo su un Postgres di prova.
- `features-test.sql`: bonus creatore, bonus giornaliero, negozio (saldo separato dalla classifica),
  profilo protetto e missioni co-op (inviti, timer, raddoppio, scadenza).
- `premi-test.sql`: badge e targhette creati dall'admin (solo l'admin li crea, periodo di disponibilità,
  acquisto o sblocco automatico a condizione, avviso una volta sola, premi posseduti non cancellabili).
