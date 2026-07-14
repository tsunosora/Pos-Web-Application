@echo off
setlocal
title Print Relay Agent
cd /d "%~dp0"

REM ── Print Relay Agent (Windows) ──────────────────────────────────────────
REM Jalankan di komputer yang colok printer. Isi 3 nilai di bawah, lalu
REM dobel-klik file ini. (agent.py harus ada di folder yang sama.)
REM   URL   = alamat backend (https), mis. https://pos.domain.com
REM   TOKEN = token dari menu Settings > Printer di web app
REM   COM   = COM port printer (USB / Bluetooth outgoing), mis. COM5

set "URL=https://pos.domain.com"
set "TOKEN=ISI_TOKEN_DISINI"
set "COM=COM5"

echo === Print Relay Agent ===
echo.

where python >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Python belum terinstal.
  echo Install dari https://www.python.org/downloads/ - centang "Add Python to PATH" - lalu jalankan ulang.
  goto :end
)

python -c "import serial" >nul 2>nul
if errorlevel 1 (
  echo Memasang pyserial...
  python -m pip install pyserial
)

if not exist "agent.py" (
  echo [ERROR] File agent.py tidak ada di folder ini.
  goto :end
)

echo Menjalankan agen... biarkan jendela ini TETAP TERBUKA.
echo.
python agent.py --url %URL% --token %TOKEN% --com %COM%

:end
echo.
pause
