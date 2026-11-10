@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
    echo O Python do projeto nao foi encontrado. Prepare o Marai antes de migrar.
    pause
    exit /b 1
)
".venv\Scripts\python.exe" "scripts\migrate_to_aiven.py"
set "migrationExitCode=%ERRORLEVEL%"
if not exist ".runtime" mkdir ".runtime"
> ".runtime\migration-aiven.exitcode" echo %migrationExitCode%
echo.
pause
exit /b %migrationExitCode%
