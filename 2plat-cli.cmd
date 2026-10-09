@echo off
rem 2plat command line, runs on the Electron runtime inside this folder (no Node.js install needed).
set ELECTRON_RUN_AS_NODE=1
"%~dp02plat.exe" "%~dp0resources\app\cli\2plat.js" %*
exit /b %errorlevel%
