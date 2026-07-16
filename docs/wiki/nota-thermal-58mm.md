# 🧾 Cetak Nota Thermal 58mm

Selain nota A5 (PDF/browser), PosPro mendukung cetak **struk thermal 58mm** untuk printer struk mini kasir. Struk dirender otomatis (logo, item, total, footer) menjadi gambar raster ESC/POS lalu dikirim ke printer. **Format A5 lama tetap tersedia dan tidak berubah.**

---

## Cara Pakai

1. Saat mencetak nota, pilih format struk **Thermal 58mm** (default A5 tetap ada).
2. Pilih **metode koneksi** printer sesuai perangkat (lihat tabel di bawah).
3. Klik cetak — struk otomatis dirender & dikirim ke printer.

### Metode koneksi printer

| Metode | Kapan dipakai | Catatan |
|--------|---------------|---------|
| **Bluetooth (Web Bluetooth)** | Printer thermal Bluetooth langsung dari HP/laptop | Chrome/Android. Struk dikirim sebagai gambar raster ESC/POS |
| **Aplikasi Desktop** | Cetak langsung ke printer Windows (spooler RAW) atau USB/COM | Tanpa agen tambahan — bisa juga melayani device lain, lihat [Aplikasi Desktop Offline](desktop-offline.md) |
| **Printer Relay** | Cabang tanpa aplikasi desktop | Agen relay meneruskan job cetak memakai token printer |
| **Browser (fallback)** | Bila metode di atas tak tersedia | Cetak lewat dialog print browser |

> ⚠️ **Safari / iOS.** Web Bluetooth **tidak didukung di Safari iOS**. Untuk iPhone/iPad, gunakan Aplikasi Desktop, Printer Relay, atau fallback browser.

---

## Cara Kerja (Teknis)

### Rendering raster

Struk HTML dirender menjadi gambar (via `html2canvas`) lalu dikonversi ke bitmap **ESC/POS raster** dan dikirim ke printer. Pendekatan raster dipilih agar hasil cetak konsisten (logo, font, layout) lintas merek printer 58mm.

> **GOTCHA payload besar.** Nota panjang (banyak item) menghasilkan raster base64 yang bisa **>100KB**. Endpoint relay (`/printer-relay/jobs`) menerima payload ini, jadi batas body-parser backend dinaikkan dari default 100KB → **10MB** (lihat `backend/src/main.ts`) agar tidak ditolak `PayloadTooLargeError`.

### Printer Relay (untuk cabang tanpa desktop app)

Agen relay (`agent.py`) melakukan **long-poll** ke backend dengan header **`x-printer-token`**, mengambil job cetak, dan meneruskannya ke printer lokal. Tiga mode koneksi:

- **Windows / spooler** (default) — kirim RAW ke printer via spooler Windows.
- **USB / COM** — kirim ke port serial.
- **Bluetooth** — kirim ke printer Bluetooth ter-pair.

Diagnosa umum:

- **401 "token ditolak"** — `x-printer-token` di agen tidak cocok dengan yang terdaftar di backend. Samakan token.
- Ada **dua salinan `agent.py`** yang wajib sinkron — pastikan keduanya versi sama saat mengubah logika.

### Aplikasi Desktop

Di aplikasi desktop, cetak ESC/POS untuk **nota device itu sendiri** dikirim **langsung dari proses utama** (tanpa relay/agen):

- **Windows (spooler RAW)** — PowerShell P/Invoke `winspool.drv WritePrinter`.
- **USB (COM)** — `System.IO.Ports.SerialPort`.
- Nol native module (tak perlu `electron-rebuild`).

Pengaturan printer aplikasi: **Settings → Printer → panel "Printer Aplikasi (Desktop)"**.

#### Aplikasi Desktop sebagai Pusat Cetak (melayani device lain)

Secara default aplikasi desktop **hanya mencetak notanya sendiri** (via IPC), **tidak** melayani device lain. Untuk menjadikannya pusat cetak cabang (banyak kasir → 1 printer di PC ini) **tanpa menjalankan `agent.py` terpisah**, isi **`printerRelayToken`** di `pospro-config.json`:

```json
{
  "centralUrl": "https://pos-anda.com",
  "printerRelayToken": "<x-printer-token dari Settings → Printer>"
}
```

Saat token diisi, aplikasi menjalankan **agen relay internal** (`desktop/src/relay-agent.ts`) yang **long-poll ke server pusat** (`centralUrl` + `/printer-relay/poll`, header `x-printer-token`), lalu mencetak job dari device lain ke printer lokal PC ini via jalur `printEscpos` yang sama. Fungsinya identik dengan `agent.py`, tapi bundel di dalam app.

> **Penting:** agen relay ini poll ke **server pusat**, bukan backend lokal — karena device kasir lain menembak pusat, jadi antrean relay ada di pusat. Token diambil dari **Settings → Printer** di server pusat (bukan device-token sync). Tanpa token, fitur nonaktif dan app hanya mencetak notanya sendiri.

---

## Lihat Juga

- [🖥️ Aplikasi Desktop Offline](desktop-offline.md) — cetak langsung ke printer Windows/USB
- [🖨️ Antrian Produksi](produksi.md) — cetak job produksi (bukan struk kasir)
- [🏭 Mesin Cetak](mesin-cetak.md) — manajemen mesin cetak produksi
