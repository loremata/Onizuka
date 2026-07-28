-- Garantisce la Row Level Security su OGNI tabella dello schema public.
-- Eseguito a ogni deploy di produzione (scripts/deploy-migrate.mjs) dopo le
-- migration: le tabelle nuove nascono senza RLS e senza questo passaggio
-- resterebbero leggibili dalla Data API con la chiave anon, se mai venisse
-- riattivata. Idempotente: tocca solo le tabelle che non ce l'hanno.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND NOT rowsecurity
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;
