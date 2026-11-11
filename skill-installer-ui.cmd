@echo off
node "%~dp0bin\skill-installer.mjs" ui %*
if errorlevel 1 pause
