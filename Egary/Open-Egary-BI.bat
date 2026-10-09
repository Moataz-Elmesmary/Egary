@echo off
rem ============================================================
rem  Egary BI launcher - opens the interactive BI dashboard directly
rem  as its own window (app mode). Nothing to install.
rem  Keep Egary.xlsx in this same folder.
rem ============================================================
set "APP=%~dp0index.html"

if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
  start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --app="file:///%APP:\=/%#/bi"
  exit /b
)
if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
  start "" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" --app="file:///%APP:\=/%#/bi"
  exit /b
)
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
  start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --app="file:///%APP:\=/%#/bi"
  exit /b
)
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
  start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" --app="file:///%APP:\=/%#/bi"
  exit /b
)
if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" (
  start "" "%LocalAppData%\Google\Chrome\Application\chrome.exe" --app="file:///%APP:\=/%#/bi"
  exit /b
)
rem No Edge or Chrome found in the usual places: use the default browser
start "" "%APP%"
