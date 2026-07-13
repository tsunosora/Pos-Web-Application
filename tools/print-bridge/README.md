# Print Bridge (Linux) — HTTP → Bluetooth SPP

Jembatan kecil agar aplikasi POS (browser) bisa mencetak ke printer thermal
**RPP02N** di **Linux desktop**, tanpa bergantung pada Web Bluetooth Chrome.

## Kenapa perlu

RPP02N adalah printer **dual-mode**. Di Linux, BlueZ memegangnya di mode
**Bluetooth Classic (Serial Port Profile / SPP)**. Web Bluetooth Chrome hanya bisa
lewat **BLE/GATT**, sehingga sering gagal mengambil alih printer → tombol
"Cetak Bluetooth" tidak jalan.

Jalur SPP sendiri **andal**. Bridge ini menerima byte ESC/POS dari aplikasi via
HTTP lalu meneruskannya ke printer via socket RFCOMM.

> Catatan: di **Android** jalur Web Bluetooth (tombol "Cetak Bluetooth") tetap
> mulus — bridge ini khusus untuk **Linux/desktop**.

## Prasyarat

- Printer sudah **paired** di Linux: `bluetoothctl` → `pair`/`trust` RPP02N.
- Python 3 (stdlib saja — **tanpa dependency**).

## Jalankan manual

```bash
python3 tools/print-bridge/bridge.py --mac 66:32:5C:C4:3B:32
```

Opsi:
- `--mac`      MAC printer (default `66:32:5C:C4:3B:32`, atau env `PRINTER_MAC`)
- `--channel`  RFCOMM channel (default: autodetect 1..6, atau env `PRINTER_CHANNEL`)
- `--port`     port HTTP (default `9100`, atau env `BRIDGE_PORT`)
- `--host`     host bind (default `127.0.0.1`)

Cek:
```bash
curl http://127.0.0.1:9100/health
# {"ok": true, "printer": "66:32:5C:C4:3B:32", "channel": null}
```

## Jalankan permanen (pm2)

```bash
pm2 start tools/print-bridge/bridge.py --name print-bridge --interpreter python3 -- --mac 66:32:5C:C4:3B:32
pm2 save
```

Atau systemd user service (`~/.config/systemd/user/print-bridge.service`):

```ini
[Unit]
Description=POS Print Bridge (HTTP -> Bluetooth SPP)
After=bluetooth.target

[Service]
ExecStart=/usr/bin/python3 %h/WEBDEV/Pos-Web-Application/tools/print-bridge/bridge.py --mac 66:32:5C:C4:3B:32
Restart=on-failure

[Install]
WantedBy=default.target
```

```bash
systemctl --user enable --now print-bridge
```

## Cara pakai di aplikasi

Saat bridge aktif, modal **Struk Thermal 58mm** otomatis menampilkan tombol
**"Cetak (Printer Server)"** (deteksi via `GET /health`). Klik → struk langsung tercetak.

URL bridge (prioritas): `localStorage thermalPrinter.bridgeUrl` → env
`NEXT_PUBLIC_BRIDGE_URL` → `http://127.0.0.1:9100`.

Override per-device dari browser:
```js
localStorage.setItem('thermalPrinter.bridgeUrl', 'http://192.168.1.10:9100')
```

## Banyak device, satu printer (print server LAN)

Printer thermal murah (RPP02N) hanya mendukung **1 koneksi Bluetooth**, jadi tak
bisa di-pair ke banyak device. Solusinya: **satu mesin memegang printer**, device
lain (Android/laptop/Linux) kirim job cetak ke mesin itu lewat jaringan. Bridge
meng-antre job (ada lock) jadi aman dipakai bergantian banyak kasir.

1. **Di mesin host** (yang printer-nya paired), jalankan bridge bind ke LAN:
   ```bash
   python3 tools/print-bridge/bridge.py --mac 66:32:5C:C4:3B:32 --host 0.0.0.0
   # atau pm2:
   pm2 start tools/print-bridge/bridge.py --name print-bridge --interpreter python3 -- --mac 66:32:5C:C4:3B:32 --host 0.0.0.0
   ```
2. Cari IP LAN host (`ip a` / `hostname -I`), mis. `192.168.1.10`. Pastikan
   **firewall mengizinkan port 9100**.
3. **Arahkan semua device** ke host itu — dua cara:
   - Global (rekomendasi): set env frontend `NEXT_PUBLIC_BRIDGE_URL=http://192.168.1.10:9100`
     lalu rebuild/redeploy. Semua device otomatis pakai server ini.
   - Per-device: jalankan di console browser tiap device
     `localStorage.setItem('thermalPrinter.bridgeUrl','http://192.168.1.10:9100')`.

Catatan:
- Jalur ini **tak butuh Web Bluetooth / HTTPS** → jalan di device mana pun,
  termasuk iOS dan yang diakses via IP LAN.
- Aplikasi & bridge harus **sama-sama di jaringan lokal** (private→private) supaya
  lolos Private Network Access. Jangan campur HTTPS-app → HTTP-bridge (mixed content).
- Cukup **1 printer**; host harus menyala selama kasir dipakai.

## API

- `GET  /health` → `{ ok, printer, channel }`
- `POST /print`  → body = **raw byte ESC/POS** (`application/octet-stream`) → `{ ok, bytes, channel }`

## Troubleshooting

- **Tombol "Cetak (Linux)" tak muncul:** bridge belum jalan / port beda. Cek `curl .../health`.
- **`/print` error "Gagal kirim ke printer":** printer mati / keluar jangkauan / belum paired.
  Uji ulang: `bluetoothctl info 66:32:5C:C4:3B:32` (harus `Paired: yes`).
- **Channel salah:** set manual `--channel 1` (RPP02N umumnya channel 1).
