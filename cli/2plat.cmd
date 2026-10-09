@echo off
setlocal
where node >nul 2>nul
if %errorlevel%==0 (
  node "%~dp02plat.js" %*
  exit /b %errorlevel%
)
set "EXE=%~dp0..\..\..\2plat.exe"
if exist "%EXE%" (
  set ELECTRON_RUN_AS_NODE=1
  "%EXE%" "%~dp02plat.js" %*
  exit /b %errorlevel%
)
echo 2plat: Node.js was not found. Install it from https://nodejs.org, or use 2plat-cli.cmd next to 2plat.exe.
exit /b 1
