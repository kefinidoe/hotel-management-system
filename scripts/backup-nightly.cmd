@echo off
REM ─────────────────────────────────────────────────────────────────────────────
REM  Nightly hotel database backup.
REM
REM  This wrapper exists so Windows Task Scheduler has something simple to run.
REM  Task Scheduler cannot cope with quotes inside a command that also changes
REM  directory, so the logic lives here instead.
REM
REM  Change BACKUP_DIR below to a OneDrive or Google Drive folder so that each
REM  night's copy leaves this computer. A backup that exists only on the PC that
REM  runs the hotel system is not a real backup.
REM ─────────────────────────────────────────────────────────────────────────────

set "REPO=C:\Users\HP\Downloads\Axis hotel hms\hms"
set "BACKUP_DIR=%REPO%\backups"

cd /d "%REPO%"

REM Make sure pg_dump can be found even when Task Scheduler runs with a bare PATH.
set "PATH=C:\Program Files\PostgreSQL\17\bin;%PATH%"

node scripts\backup-db.mjs --keep 30 --out "%BACKUP_DIR%" >> "%BACKUP_DIR%\backup-log.txt" 2>&1

if errorlevel 1 (
  echo [%DATE% %TIME%] BACKUP FAILED - see the messages above >> "%BACKUP_DIR%\backup-log.txt"
) else (
  echo [%DATE% %TIME%] backup OK >> "%BACKUP_DIR%\backup-log.txt"
)
