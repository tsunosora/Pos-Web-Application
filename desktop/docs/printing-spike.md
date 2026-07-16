# Spike: Cetak ESC/POS RAW dari Node/Electron (Task 2.1)

## Masalah
Kirim byte ESC/POS RAW ke printer thermal dari main process Electron di Windows,
tanpa agen Python `agent.py`/`.bat`. Harus setara 3 mode agen: `windows` (spooler
RAW), `usb`/`com`, `bluetooth`.

## Kandidat yang dipertimbangkan

| Opsi | Native module? | Risiko | Verdict |
|------|----------------|--------|---------|
| `@grandchef/node-printer` / `@thiagoelg/node-printer` | Ya (butuh `electron-rebuild` per ABI) | Gagal kompilasi/rebuild saat upgrade Electron; paket kurang terawat | ❌ Ditolak |
| Bundel `RawPrint.exe` + `child_process` | Tidak (tapi biner eksternal) | Perlu distribusi biner pihak-ketiga, antivirus false-positive | ⚠️ Cadangan |
| **PowerShell + P/Invoke `winspool.drv WritePrinter`** | **Tidak** | Windows-only (tapi target memang Windows); butuh .NET Framework (selalu ada Win10/11) | ✅ **DIPILIH** |
| `serialport` npm (mode COM) | Ya (prebuilt utk Electron) | Native, tapi punya prebuilt | ❌ diganti PowerShell SerialPort |

## Keputusan

**Nol native module.** Semua cetak lewat PowerShell yang sudah ada di Windows:

- **Mode `windows` (spooler RAW):** `Add-Type` meng-compile C# kecil yang P/Invoke
  `OpenPrinter/StartDocPrinter(RAW)/WritePrinter/EndDocPrinter` dari `winspool.Drv`.
  Ini replika persis jalur ctypes winspool di `agent.py` (mode spooler).
- **Mode `usb`/`bluetooth` (COM):** `System.IO.Ports.SerialPort` bawaan .NET
  (9600 baud), setara mode COM `agent.py`. Bluetooth Windows di-map sbg COM outgoing.
- **`listPrinters`:** `Get-Printer` (fallback WMI `Win32_Printer`).
- **Bluetooth BLE sejati:** ditunda ke fase Android (Capacitor).

Byte dikirim ke PowerShell lewat **file sementara biner** (bukan argumen) untuk
menghindari batas panjang argumen & masalah encoding.

**Fallback dev (Linux/macOS):** `lp -o raw` (CUPS) agar `printEscpos` bisa diuji
lintas-platform saat pengembangan. Set `POSPRO_PRINT_DRYRUN=1` untuk hanya mencatat
(log) tanpa benar-benar mencetak.

## Verifikasi hardware (WAJIB dilakukan user di Windows)
Kriteria lulus: 1 struk uji keluar dari printer thermal nyata via mode `windows`
(nama printer dari `Get-Printer`) dan via mode `usb` (COM). Belum bisa diuji di
mesin dev Linux ini — sudah diverifikasi: kode compile + jalur platform benar +
PowerShell script ter-generate valid.
