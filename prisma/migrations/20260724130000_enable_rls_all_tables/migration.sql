-- Sicurezza: attiva Row Level Security su TUTTE le tabelle dello schema public.
--
-- Contesto: il progetto Supabase espone la Data API (PostgREST) su internet; i
-- ruoli pubblici `anon`/`authenticated` avevano privilegi pieni e RLS era spento
-- su 80/81 tabelle → con la chiave anon (pubblica per design) si potevano
-- leggere/scrivere tutti i dati. L'app NON usa PostgREST: si connette con il
-- ruolo `prisma` (rolbypassrls=true) via Prisma, quindi con RLS attivo e nessuna
-- policy gli attori pubblici vedono 0 righe mentre l'app continua a funzionare.
--
-- Idempotente: tocca solo le tabelle che non hanno ancora RLS attivo.
-- NB: richiede ruolo owner/superuser. In produzione è già stata applicata
-- manualmente come superuser `postgres` (24/07/2026) e registrata con
-- `prisma migrate resolve --applied`.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND NOT rowsecurity
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
  END LOOP;
END $$;
