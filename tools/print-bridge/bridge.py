#!/usr/bin/env python3
"""
Print Bridge — jembatan HTTP -> printer thermal (ESC/POS), lintas platform.

Kenapa ada: mencetak dari aplikasi web (browser) ke printer thermal Bluetooth
tanpa bergantung pada Web Bluetooth (yang rewel & sering "nyangkut" di Chrome
desktop). Bridge menerima byte ESC/POS via HTTP lalu meneruskan ke printer.

Dua mode:
  * Windows : tulis ke COM port Bluetooth  -> jalankan dgn  --com COM5
  * Linux   : socket RFCOMM ke MAC printer  -> jalankan dgn  --mac 66:32:5C:C4:3B:32

Endpoint:
  GET  /health -> {"ok":true,"target":"COM5" | "66:..:32","mode":"com|rfcomm"}
  POST /print  -> body = raw byte ESC/POS (application/octet-stream). 200 bila sukses.

Tanpa dependency wajib (stdlib Python 3). Di Windows, kalau `pyserial` terpasang
(`pip install pyserial`) dipakai (paling andal); kalau tidak, fallback tulis
mentah langsung ke device COM.
"""

import argparse
import http.server
import json
import os
import socket
import sys
import threading
import time

DEFAULT_MAC = os.environ.get("PRINTER_MAC", "")
DEFAULT_COM = os.environ.get("PRINTER_COM", "")           # mis. "COM5" (Windows)
DEFAULT_PORT = int(os.environ.get("BRIDGE_PORT", "9100"))
DEFAULT_CHANNEL = os.environ.get("PRINTER_CHANNEL")       # None -> autodetect 1..6

_lock = threading.Lock()          # printer serial = 1 job sekaligus
_mac = ""
_com = ""
_known_channel = None


def _send_via_com(payload: bytes) -> str:
    """Kirim ke printer via COM port (Windows). Pakai pyserial bila ada, else raw."""
    try:
        import serial  # pyserial
        ser = serial.Serial(port=_com, baudrate=9600, timeout=3, write_timeout=8)
        try:
            for i in range(0, len(payload), 180):
                ser.write(payload[i:i + 180])
                ser.flush()
                time.sleep(0.02)
            time.sleep(0.4)
        finally:
            ser.close()
        return _com
    except ImportError:
        # Fallback tanpa pyserial: tulis mentah ke device COM.
        path = _com if _com.startswith("\\\\.\\") else ("\\\\.\\" + _com)
        with open(path, "wb", buffering=0) as f:
            f.write(payload)
        return _com


def _send_via_rfcomm(payload: bytes) -> str:
    """Kirim ke printer via RFCOMM (Linux). Return 'MAC ch<n>'."""
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
                for i in range(0, len(payload), 180):
                    s.send(payload[i:i + 180])
                    time.sleep(0.02)
                time.sleep(0.4)
            finally:
                s.close()
            _known_channel = ch
            return f"{_mac} ch{ch}"
        except Exception as e:  # noqa: BLE001 — coba channel berikutnya
            last_err = e
            continue
    raise RuntimeError(f"Gagal kirim ke printer {_mac}: {last_err}")


def _send(payload: bytes) -> str:
    if _com:
        return _send_via_com(payload)
    return _send_via_rfcomm(payload)


def _target() -> str:
    return _com if _com else _mac


def _mode() -> str:
    return "com" if _com else "rfcomm"


class Handler(http.server.BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Private-Network", "true")

    def _json(self, code: int, obj: dict):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        return

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        if self.path.split("?")[0] == "/health":
            self._json(200, {"ok": True, "target": _target(), "mode": _mode()})
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
                where = _send(payload)
            self._json(200, {"ok": True, "bytes": len(payload), "target": where})
        except Exception as e:  # noqa: BLE001
            self._json(500, {"ok": False, "error": str(e)})


def main():
    global _mac, _com, _known_channel
    ap = argparse.ArgumentParser(description="HTTP -> printer thermal bridge (COM / RFCOMM)")
    ap.add_argument("--com", default=DEFAULT_COM, help="COM port Windows, mis. COM5")
    ap.add_argument("--mac", default=DEFAULT_MAC, help="MAC printer Bluetooth (Linux/RFCOMM)")
    ap.add_argument("--channel", type=int, default=int(DEFAULT_CHANNEL) if DEFAULT_CHANNEL else None,
                    help="RFCOMM channel (default autodetect 1..6)")
    ap.add_argument("--port", type=int, default=DEFAULT_PORT, help="Port HTTP bridge")
    ap.add_argument("--host", default="127.0.0.1", help="Host bind (default 127.0.0.1)")
    args = ap.parse_args()

    _com = args.com.strip()
    _mac = args.mac.strip()
    _known_channel = args.channel

    if not _com and not _mac:
        print("ERROR: wajib pilih target printer — Windows: --com COM5 | Linux: --mac <MAC>", file=sys.stderr)
        sys.exit(2)

    server = http.server.ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"[print-bridge] listening http://{args.host}:{args.port}  mode={_mode()}  target={_target()}")
    print("[print-bridge] GET /health  |  POST /print (body=raw ESC/POS bytes)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[print-bridge] stop")
        server.shutdown()


if __name__ == "__main__":
    main()
