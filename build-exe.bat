@echo off
setlocal
rem Builds 2plat.exe on Windows. Needs internet (downloads the official Electron runtime from GitHub, ~115 MB).
set VER=33.2.1
set OUT=%~dp02plat-win32-x64
set ZIP=%TEMP%\electron-v%VER%-win32-x64.zip
echo Downloading Electron %VER% ...
powershell -NoProfile -Command "[Net.ServicePointManager]::SecurityProtocol='Tls12'; Invoke-WebRequest -Uri 'https://github.com/electron/electron/releases/download/v%VER%/electron-v%VER%-win32-x64.zip' -OutFile '%ZIP%'" || goto :fail
if exist "%OUT%" rmdir /s /q "%OUT%"
powershell -NoProfile -Command "Expand-Archive -Path '%ZIP%' -DestinationPath '%OUT%' -Force" || goto :fail
ren "%OUT%\electron.exe" 2plat.exe
if exist "%OUT%\resources\default_app.asar" del "%OUT%\resources\default_app.asar"
mkdir "%OUT%\resources\app\src" "%OUT%\resources\app\build"
copy /y "%~dp0main.js" "%OUT%\resources\app\" >nul
copy /y "%~dp0preload.js" "%OUT%\resources\app\" >nul
copy /y "%~dp0index.html" "%OUT%\resources\app\" >nul
copy /y "%~dp0package.json" "%OUT%\resources\app\" >nul
copy /y "%~dp0build\icon.png" "%OUT%\resources\app\build\" >nul
copy /y "%~dp0src\*" "%OUT%\resources\app\src\" >nul
mkdir "%OUT%\resources\app\cli"
copy /y "%~dp0cli\*" "%OUT%\resources\app\cli\" >nul
copy /y "%~dp02plat-cli.cmd" "%OUT%\" >nul
echo.
echo Done! Editor: %OUT%\2plat.exe
echo Command line: %OUT%\2plat-cli.cmd help
if not defined CI pause
exit /b 0
:fail
echo Build failed - check your internet connection.
if not defined CI pause
exit /b 1
