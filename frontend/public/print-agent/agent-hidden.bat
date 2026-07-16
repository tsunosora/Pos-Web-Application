@echo off
REM ── Print Relay Agent — versi JALAN DIAM (tanpa jendela) ─────────────────
REM Jangan dobel-klik file ini langsung (masih memunculkan jendela sebentar).
REM Jalankan lewat run-hidden.vbs, dan daftarkan run-hidden.vbs ke folder
REM Startup (Win+R -> shell:startup) supaya auto-run tersembunyi saat login.
REM
REM Isi 3 nilai di bawah:
REM   URL   = alamat backend (https), mis. https://pos.domain.com
REM   TOKEN = token dari menu Settings > Printer di web app
REM   COM   = COM port printer (USB / Bluetooth outgoing), mis. COM5
REM Printer USB yang muncul sbg ANTREAN Windows (bukan COM)? ganti baris
REM terakhir jadi:  python agent.py --url %URL% --token %TOKEN% --printer "RP58 Printer"
cd /d "%~dp0"

set "URL=https://pos.domain.com"
set "TOKEN=ISI_TOKEN_DISINI"
set "COM=COM5"

REM Pasang pyserial diam-diam bila belum ada (butuh untuk COM port).
python -c "import serial" >nul 2>nul || python -m pip install pyserial >nul 2>nul

REM Semua output (termasuk error mis. "401 token ditolak") masuk ke agent.log
REM di folder ini — buka file itu kalau cetak bermasalah.
python agent.py --url %URL% --token %TOKEN% --com %COM% >> "%~dp0agent.log" 2>&1
