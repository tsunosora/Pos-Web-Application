# 🖨️ Printer Relay Agent — Cetak Thermal untuk Cabang

**Printer Relay Agent** (`agent.py`) adalah program kecil yang dijalankan di **PC kasir yang colok printer thermal**. Ia "menelpon keluar" ke server PosPro (long-poll), mengambil job cetak, lalu meneruskannya ke printer lokal — sehingga **banyak kasir bisa mencetak ke satu printer** tanpa buka port/firewall dan tanpa masalah *mixed-content* HTTPS.

> Kapan pakai ini? Untuk **cabang tanpa Aplikasi Desktop**. Kalau cabang sudah pakai [Aplikasi Desktop Offline](desktop-offline.md), agen relay sudah bundel di dalamnya (cukup isi `printerRelayToken`) — tidak perlu `agent.py` terpisah. Lihat juga [Nota Thermal 58mm](nota-thermal-58mm.md).

---

## Prasyarat

1. **Python** terpasang di PC kasir — unduh dari <https://python.org>, centang **Add Python to PATH**.
2. **`pyserial`** (untuk printer USB/COM): buka Command Prompt → `pip install pyserial`.
   (Helper `agent-hidden.bat` memasang ini otomatis bila belum ada.)
3. **Token printer** — dari menu **Settings → Printer** di web app (token perangkat, **bukan** login user).
4. Tahu **cara koneksi printer**:
   - **COM port** (USB / Bluetooth outgoing) → mis. `COM5` (cek di *Device Manager → Ports (COM & LPT)*, pakai port **Outgoing**).
   - **Antrean Windows** (printer USB yang muncul sebagai printer/queue Windows, tanpa COM) → pakai **nama persis** printer di *Windows Printers*.

---

## Instalasi

Unduh 3 file ini dan taruh **di satu folder** (mis. `C:\print-agent\`):

| File | Fungsi |
|------|--------|
| `agent.py` | program agen relay (inti) |
| `agent-hidden.bat` | menjalankan agen tanpa `pause` + tulis log ke `agent.log` |
| `run-hidden.vbs` | launcher yang membuat jendelanya **benar-benar hilang** |

> Ketiganya tersedia untuk diunduh dari web app di `…/print-agent/agent.py`, `…/print-agent/agent-hidden.bat`, `…/print-agent/run-hidden.vbs`. (Sumber di repo: `frontend/public/print-agent/` dan `tools/print-bridge/`.)

Lalu **edit `agent-hidden.bat`** — isi 3 nilai:

```bat
set "URL=https://pos.domain.com"
set "TOKEN=ISI_TOKEN_DISINI"
set "COM=COM5"
```

> Printer yang muncul sebagai **antrean Windows** (bukan COM)? Ubah baris terakhir `agent-hidden.bat` menjadi:
> `python agent.py --url %URL% --token %TOKEN% --printer "RP58 Printer"` (ganti dengan nama printer persis di Windows), dan hapus `--com %COM%`.

---

## Auto-run TERSEMBUNYI (jalan otomatis saat Windows nyala)

### Metode A — Folder Startup (paling mudah)

1. **Tes dulu:** dobel-klik **`run-hidden.vbs`**. Kalau **tak ada jendela muncul** = benar.
   Cek **Task Manager → Details** ada proses `python.exe`, lalu coba cetak dari POS.
2. Buka folder Startup: `Win + R` → ketik **`shell:startup`** → Enter.
3. Klik-kanan **`run-hidden.vbs`** → **Show more options → Create shortcut**.
4. Pindahkan **shortcut**-nya ke folder Startup tadi.
   ⚠️ Jangan pindahkan file `.vbs` aslinya — cukup **shortcut**-nya, supaya path ke `agent.py` tetap benar.

Selesai — tiap login Windows, agen jalan otomatis & tak terlihat.

### Metode B — Task Scheduler (paling andal, auto-restart)

Cocok kalau ingin agen **restart otomatis** bila crash.

1. Buka **Task Scheduler** → **Create Task…** (bukan *Basic Task*).
2. Tab **General**: Name `Print Relay Agent`; centang **Hidden**.
3. Tab **Triggers** → **New** → *Begin the task:* **At log on** → OK.
4. Tab **Actions** → **New**:
   - *Program/script:* path `pythonw.exe` (mis. `C:\Users\<nama>\AppData\Local\Programs\Python\Python312\pythonw.exe`)
   - *Add arguments:* `agent.py --url https://pos.domain.com --token ISI_TOKEN --com COM5`
   - *Start in:* `C:\print-agent`
5. Tab **Settings**: **hilangkan** centang *"Stop the task if it runs longer than…"* (agen memang jalan terus); centang *"If the task fails, restart every 1 minute"*.
6. OK → klik-kanan task → **Run** untuk tes.

> `pythonw.exe` = Python tanpa jendela console, jadi tak perlu VBS di metode ini.

---

## Cek jalan & log

- **Proses jalan?** Task Manager → tab **Details** → cari `python.exe` (Metode A) atau `pythonw.exe` (Metode B).
- **Log:** semua output & error ditulis ke **`agent.log`** di folder agen. Buka file ini saat cetak bermasalah.
- **Berhenti/restart agen:** akhiri proses di Task Manager (atau *End task* pada task Scheduler), lalu jalankan `run-hidden.vbs` / Run task lagi.

---

## Troubleshooting

| Gejala | Penyebab & solusi |
|--------|-------------------|
| **`401 token ditolak`** di `agent.log` | `x-printer-token` di agen tidak cocok dengan yang terdaftar di backend. Samakan `TOKEN` dengan **Settings → Printer**. |
| Job tak tercetak, tak ada error | COM port salah / printer mati / di luar jangkauan. Coba COM **Outgoing** yang lain, atau `pip install pyserial` lalu ulang. |
| Printer USB tak punya COM | Printer muncul sebagai **antrean Windows** → pakai mode `--printer "Nama Printer"` (lihat catatan di atas). |
| Jendela sempat berkedip saat login | Pastikan yang di Startup adalah **`run-hidden.vbs`** (Metode A) atau `pythonw.exe` (Metode B), bukan `.bat` langsung. |
| Payload besar / nota panjang ditolak | Batas body-parser backend sudah dinaikkan ke 10MB (lihat [Nota Thermal 58mm](nota-thermal-58mm.md)). Pastikan backend terbaru. |

---

## Catatan penting

- **Dua salinan `agent.py` wajib sinkron** — ada di `tools/print-bridge/agent.py` dan `frontend/public/print-agent/agent.py`. Saat mengubah logika agen, perbarui **keduanya** ke versi yang sama.
- **1 printer thermal = 1 koneksi.** Printer terhubung ke **satu** PC host. PC itulah yang mencetak; kasir lain mengirim job lewat server (relay), bukan langsung ke printer.
- Ini solusi untuk cabang tanpa desktop app. Rencana ke depan, [Aplikasi Desktop Offline](desktop-offline.md) menggantikan `agent.py` (cetak langsung, tanpa `.bat`).
