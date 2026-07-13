# Print Bridge — cetak thermal dari aplikasi web tanpa Web Bluetooth

Jembatan kecil (`bridge.py`) yang menerima struk (byte ESC/POS) dari aplikasi POS
di browser lalu meneruskannya ke printer thermal. **Tidak memakai Bluetooth
Chrome sama sekali**, jadi bebas dari masalah "device nyangkut di Chrome" & GATT
sering putus.

Dua mode:
- **Windows** → tulis ke **COM port** Bluetooth printer (`--com COM5`). ⭐ untuk kasir.
- **Linux** → socket **RFCOMM** ke MAC printer (`--mac ...`). (mesin dev)

---

## WINDOWS (device kasir) — langkah lengkap

### 1. Pair printer di Windows → dapatkan COM port
1. Nyalakan printer. Buka **Settings → Bluetooth & devices → Add device → Bluetooth**.
2. Pilih **RPP02N**, pair (kalau minta PIN: `0000` atau `1234`).
3. Buka **Control Panel → Devices and Printers** (atau *Bluetooth settings → COM Ports*).
   Catat **COM port "Outgoing"** untuk RPP02N, mis. `COM5`.
   (Bisa juga cek di *Device Manager → Ports (COM & LPT)*.)

### 2. Pasang Python + jalankan bridge
1. Install Python dari <https://python.org> (centang **Add Python to PATH**).
2. (Opsional, lebih andal) buka Command Prompt: `pip install pyserial`
3. Jalankan bridge (ganti COM5 sesuai punyamu):
   ```
   python bridge.py --com COM5
   ```
   Muncul: `listening http://127.0.0.1:9100  mode=com  target=COM5`
4. Tes: buka browser ke <http://127.0.0.1:9100/health> → harus `{"ok": true, ...}`.

### 3. Jalankan otomatis saat Windows nyala (opsional)
Buat file `jalankan-bridge.bat`:
```bat
@echo off
python "C:\path\ke\tools\print-bridge\bridge.py" --com COM5
```
Taruh shortcut-nya di folder **Startup** (`Win+R` → `shell:startup`).

### 4. Pakai di aplikasi
Buka aplikasi POS seperti biasa. Saat modal **Struk Thermal 58mm** muncul, akan ada
tombol **"Cetak (Printer Server)"** (bridge terdeteksi otomatis). Klik → tercetak.
Aplikasi HTTPS boleh memanggil `http://127.0.0.1` (localhost dikecualikan dari
mixed-content, jadi aman).

---

## LINUX (mesin dev)

```bash
python3 bridge.py --mac 66:32:5C:C4:3B:32
```
Opsi: `--channel` (default autodetect 1..6), `--port` (default 9100), `--host`.
Prasyarat: printer JANGAN di-pair di bluetoothctl (biar tak direbut mode Classic).

---

## Konfigurasi URL bridge di aplikasi

Prioritas: `localStorage thermalPrinter.bridgeUrl` → env `NEXT_PUBLIC_BRIDGE_URL`
→ `http://127.0.0.1:9100`. Default sudah pas untuk bridge lokal per-device.

## API

- `GET  /health` → `{ ok, target, mode }`  (`mode` = `com` | `rfcomm`)
- `POST /print`  → body = **raw byte ESC/POS** (`application/octet-stream`)

## Catatan penting soal berbagi 1 printer

- Printer thermal murah hanya bisa **1 koneksi**. Dengan bridge, printer terhubung
  ke **satu** mesin host (COM port). Mesin itulah yang mencetak.
- Kalau mau device lain (HP Android / PC lain) ikut mencetak ke printer yang sama,
  mereka harus mengirim ke host lewat jaringan. Karena aplikasi **HTTPS**, panggilan
  ke bridge di IP lain (http) akan diblokir *mixed-content* — solusinya perlu bridge
  di-proxy lewat HTTPS domain aplikasi (mis. lokasi `/printbridge` di nginx/caddy).
  Diskusikan dulu; untuk awal, paling simpel **1 printer per mesin host**.

## Troubleshooting

- **Tombol "Cetak (Printer Server)" tak muncul:** bridge belum jalan / COM salah.
  Cek `http://127.0.0.1:9100/health` di browser mesin itu.
- **`/print` error:** printer mati / keluar jangkauan / COM port salah. Coba COM
  port "Outgoing" yang lain, atau `pip install pyserial` lalu ulang.
- **COM port tak muncul di Windows:** hapus pairing lalu pair ulang; pastikan
  layanan *Bluetooth Support Service* jalan.
