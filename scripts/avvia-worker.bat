@echo off
REM Avvia il worker di scraping Onizuka (doppio-click).
REM Lascia questa finestra aperta: resta in ascolto dei job avviati da Onizuka.
cd /d "%~dp0.."
echo ============================================
echo   Onizuka - Worker Scraping aziende
echo   (lascia questa finestra aperta)
echo ============================================
echo.
call pnpm run scraper:worker
echo.
echo Il worker si e' fermato. Premi un tasto per chiudere.
pause >nul
