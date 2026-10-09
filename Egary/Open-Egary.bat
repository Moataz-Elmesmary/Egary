@echo off
rem ============================================================
rem  Egary launcher - opens index.html in Microsoft Edge or Google Chrome
rem  (the browsers that support automatic Excel file sync).
rem  Nothing to install. Keep Egary.xlsx in this same folder.
rem ============================================================
set "APP=%~dp0index.html"

if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
  start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" "%APP%"
  exit /b
)
if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
  start "" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" "%APP%"
  exit /b
)
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
  start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" "%APP%"
  exit /b
)
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
  start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" "%APP%"
  exit /b
)
if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" (
  start "" "%LocalAppData%\Google\Chrome\Application\chrome.exe" "%APP%"
  exit /b
)
rem No Edge or Chrome found in the usual places: use the default browser
start "" "%APP%"
