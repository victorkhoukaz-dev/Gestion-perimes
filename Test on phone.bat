@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0test-company-returns.ps1" -Phone -Cloudflare
pause
