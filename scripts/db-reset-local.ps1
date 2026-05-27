# Database pulito per sviluppo locale (cancella volume Docker e riapplica migrazioni).
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

Write-Host "Arresto Postgres e rimozione volume..."
docker compose down -v

Write-Host "Avvio Postgres..."
docker compose up -d
Start-Sleep -Seconds 4

Write-Host "Migrazioni..."
npx prisma migrate deploy

Write-Host "Seed..."
npm run db:seed

Write-Host "Fatto. Avvia l'app con: npm run dev"
