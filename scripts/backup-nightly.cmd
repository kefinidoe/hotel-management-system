@echo off
REM Nightly hotel database backup - run by Task Scheduler.
REM BACKUP_DIR below points at OneDrive. Change it if your OneDrive is elsewhere.
REM If that folder cannot be created, the backup falls back to the backups folder
REM inside the project, so the night is never skipped entirely.
setlocal
set "REPO=C:\Users\HP\Downloads\Axis hotel hms\hms"
set "BACKUP_DIR=C:\Users\HP\OneDrive\HMS-Backups"
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%" 2>nul
if not exist "%BACKUP_DIR%" set "BACKUP_DIR=%REPO%\backups"
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%" 2>nul
set "LOG=%BACKUP_DIR%\backup-log.txt"
cd /d "%REPO%"
set "PATH=C:\Program Files\PostgreSQL\17\bin;%PATH%"
node scripts\backup-db.mjs --keep 30 --out "%BACKUP_DIR%" >> "%LOG%" 2>&1
if errorlevel 1 (
  echo [%DATE% %TIME%] BACKUP FAILED - see the messages above >> "%LOG%"
  exit /b 1
)
echo [%DATE% %TIME%] backup OK >> "%LOG%"
exit /b 0
