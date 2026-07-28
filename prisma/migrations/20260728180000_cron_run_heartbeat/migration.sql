-- Battito dei lavori notturni: una riga per esecuzione di cron.
-- Nasce dall'incidente del 28/07 (deploy falliti tutto il giorno senza che
-- nessuno se ne accorgesse) e da quello del 17-28/07 (migration mai applicate):
-- il silenzio aveva lo stesso aspetto del funzionamento corretto.
CREATE TABLE IF NOT EXISTS "CronRun" (
    "id"          TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "startedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt"  TIMESTAMP(3),
    "ok"          BOOLEAN,
    "durationMs"  INTEGER,
    "httpStatus"  INTEGER,
    "resultJson"  TEXT,
    "errorDetail" TEXT,

    CONSTRAINT "CronRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CronRun_name_startedAt_idx" ON "CronRun"("name", "startedAt");
CREATE INDEX IF NOT EXISTS "CronRun_startedAt_idx" ON "CronRun"("startedAt");

ALTER TABLE "CronRun" ENABLE ROW LEVEL SECURITY;
