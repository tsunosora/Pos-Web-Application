#!/usr/bin/env python3
"""
Print Bridge — jembatan HTTP -> Bluetooth SPP (RFCOMM) untuk printer thermal.

Kenapa ada: di Linux desktop, Web Bluetooth (BLE) Chrome sering gagal ambil alih
printer dual-mode (RPP02N) karena BlueZ sudah memegangnya di mode Bluetooth Classic
(Serial Port Profile). Padahal jalur SPP sendiri andal. Bridge ini menerima byte
ESC/POS dari aplikasi POS (browser) via HTTP lalu meneruskannya ke printer via
socket RFCOMM — persis mekanisme yang terbukti jalan.

Endpoint:
  GET  /health -> {"ok":true,"printer":"<mac>","channel":<n|null>}
  POST /print  -> body = raw byte ESC/POS (application/octet-stream). 200 bila sukses.

Tanpa dependency eksternal — hanya stdlib Python 3. Jalankan:
  python3 bridge.py --mac 66:32:5C:C4:3B:32
Konfigurasi juga bisa via env: PRINTER_MAC, PRINTER_CHANNEL, BRIDGE_PORT.
"""

import argparse
import http.server
import json
import os
import socket
import threading
import time

DEFAULT_MAC = os.environ.get("PRINTER_MAC", "66:32:5C:C4:3B:32")
DEFAULT_PORT = int(os.environ.get("BRIDGE_PORT", "9100"))
DEFAULT_CHANNEL = os.environ.get("PRINTER_CHANNEL")  # None -> autodetect 1..6

# State koneksi printer (di-guard lock; printer serial = harus 1 job sekaligus).
_lock = threading.Lock()
_known_channel = int(DEFAULT_CHANNEL) if DEFAULT_CHANNEL else None
_mac = DEFAULT_MAC


def _send_via_rfcomm(payload: bytes) -> int:
    """Kirim payload ke printer via RFCOMM. Return channel yang berhasil dipakai."""
    global _known_channel
    channels = [_known_channel] if _known_channel else []
    channels += [c for c in range(1, 7) if c not in channels]

    last_err = None
    for ch in channels:
        try:
            s = socket.socket(socket.AF_BLUETOOTH, socket.SOCK_STREAM, socket.BTPROTO_RFCOMM)
            s.settimeout(10)
            s.connect((_mac, ch))
            try:
                # Kirim per-chunk kecil dengan jeda — printer BLE/SPP murah rawan overflow buffer.
                for i in range(0, len(payload), 180):
                    s.send(payload[i:i + 180])
                    time.sleep(0.02)
                time.sleep(0.4)  # beri waktu buffer printer sebelum socket ditutup
            finally:
                s.close()
            _known_channel = ch
            return ch
        except Exception as e:  # noqa: BLE001 — coba channel berikutnya
            last_err = e
            continue
    raise RuntimeError(f"Gagal kirim ke printer {_mac}: {last_err}")


class Handler(http.server.BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    # --- util ---
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        # Private Network Access (Chrome) — izinkan request dari origin lokal.
        self.send_header("Access-Control-Allow-Private-Network", "true")

    def _json(self, code: int, obj: dict):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):  # kurangi noise; log ringkas saja
        return

    # --- handlers ---
    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        if self.path.split("?")[0] == "/health":
            self._json(200, {"ok": True, "printer": _mac, "channel": _known_channel})
        else:
            self._json(404, {"ok": False, "error": "not found"})

    def do_POST(self):
        if self.path.split("?")[0] != "/print":
            self._json(404, {"ok": False, "error": "not found"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length <= 0:
            self._json(400, {"ok": False, "error": "empty body"})
            return
        payload = self.rfile.read(length)
        try:
            with _lock:
                ch = _send_via_rfcomm(payload)
            self._json(200, {"ok": True, "bytes": len(payload), "channel": ch})
        except Exception as e:  # noqa: BLE001
            self._json(500, {"ok": False, "error": str(e)})


def main():
    global _mac, _known_channel
    ap = argparse.ArgumentParser(description="HTTP -> Bluetooth SPP print bridge")
    ap.add_argument("--mac", default=DEFAULT_MAC, help="MAC printer Bluetooth")
    ap.add_argument("--channel", type=int, default=int(DEFAULT_CHANNEL) if DEFAULT_CHANNEL else None,
                    help="RFCOMM channel (default: autodetect 1..6)")
    ap.add_argument("--port", type=int, default=DEFAULT_PORT, help="Port HTTP bridge")
    ap.add_argument("--host", default="127.0.0.1", help="Host bind (default 127.0.0.1)")
    args = ap.parse_args()

    _mac = args.mac
    _known_channel = args.channel

    server = http.server.ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"[print-bridge] listening http://{args.host}:{args.port}  printer={_mac}  "
          f"channel={_known_channel or 'auto'}")
    print("[print-bridge] GET /health  |  POST /print (body=raw ESC/POS bytes)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[print-bridge] stop")
        server.shutdown()


if __name__ == "__main__":
    main()
