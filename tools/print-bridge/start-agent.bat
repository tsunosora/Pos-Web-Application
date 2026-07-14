@echo off
REM ── Print Relay Agent (Windows) ──────────────────────────────────────────
REM Jalankan di komputer utama toko yang colok printer. Isi 3 nilai di bawah,
REM lalu dobel-klik file ini. Untuk auto-start: taruh shortcut-nya di
REM shell:startup, atau daftarkan lewat Task Scheduler.
REM
REM   URL   = alamat aplikasi/backend (https), mis. https://pos.domain.com
REM   TOKEN = token dari menu Settings > Printer di web app
REM   COM   = COM port printer (USB atau Bluetooth outgoing), mis. COM5
REM           (cek di: Settings Bluetooth > More Bluetooth settings > COM Ports)

set URL=https://pos.domain.com
set TOKEN=ISI_TOKEN_DISINI
set COM=COM5

echo Menjalankan Print Relay Agent...
python "%~dp0agent.py" --url %URL% --token %TOKEN% --com %COM%
pause
