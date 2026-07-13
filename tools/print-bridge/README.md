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
**"Cetak (Linux)"** (deteksi via `GET /health`). Klik → struk langsung tercetak.

Override URL bridge (mis. port lain) dari browser:
```js
localStorage.setItem('thermalPrinter.bridgeUrl', 'http://127.0.0.1:9100')
```

## API

- `GET  /health` → `{ ok, printer, channel }`
- `POST /print`  → body = **raw byte ESC/POS** (`application/octet-stream`) → `{ ok, bytes, channel }`

## Troubleshooting

- **Tombol "Cetak (Linux)" tak muncul:** bridge belum jalan / port beda. Cek `curl .../health`.
- **`/print` error "Gagal kirim ke printer":** printer mati / keluar jangkauan / belum paired.
  Uji ulang: `bluetoothctl info 66:32:5C:C4:3B:32` (harus `Paired: yes`).
- **Channel salah:** set manual `--channel 1` (RPP02N umumnya channel 1).
