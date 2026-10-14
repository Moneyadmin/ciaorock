# Test

- `rls-test.sql`: verifica le regole del database (chi può scrivere cosa, visibilità della posizione).
  Si esegue su un Postgres di prova dopo aver applicato tutte le migrazioni e simulato lo schema `auth`
  di Supabase (ruoli `anon`/`authenticated`/`service_role`, `auth.uid()`, `auth.role()`, `auth.users`).
  **Non eseguirlo su un database reale**: inserisce utenti e dati finti.
