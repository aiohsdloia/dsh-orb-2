@echo off
rem Steward Hub autostart shim: put a shortcut to this file into shell:startup
powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0start-steward-hub.ps1" -Port 3107 -GatewayPort 8080 -Weekly
