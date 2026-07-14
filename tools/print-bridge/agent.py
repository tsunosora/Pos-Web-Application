#!/usr/bin/env python3
"""
Print Relay Agent - jembatan aplikasi (cloud/https) -> printer thermal lokal.

Beda dengan bridge.py: bridge.py = HTTP server LAN (device menembak IP-nya, kena
mixed-content saat app https). agent.py = "menelpon KELUAR" ke backend via HTTP
long-poll, jadi:
  * tak perlu buka port/firewall di komputer ini,
  * tak kena mixed-content (semua lewat https backend),
  * banyak kasir bisa cetak ke 1 printer ini tanpa pairing.

Cara kerja: loop GET {AGENT_URL}/printer-relay/poll (ditahan ~25s oleh server).
Kalau ada job (byte ESC/POS base64) -> cetak ke printer -> POST /printer-relay/ack.

Koneksi ke printer (PILIHAN):
  * Printer Win   : --printer "RP58 Printer"  (Windows spooler RAW; untuk printer
                    USB yang muncul sbg antrean/queue Windows -> port USB001 dsb.
                    dan TIDAK punya COM port. Pakai NAMA persis di Windows Printers.)
  * USB (COM)     : --com COM5           (Windows; pyserial bila ada, else raw)
  * Bluetooth     : --mac 66:32:5C:..    (Linux RFCOMM; autodetect channel 1..6)
                    di Windows, printer Bluetooth juga muncul sbg COM -> pakai --com

Auth: token perangkat dari halaman Settings > Printer (bukan login user).

Contoh:
  # Printer USB Windows (muncul sbg antrean Windows, tanpa COM) -- REKOMENDASI
  python agent.py --url https://pos.domain.com --token <TOKEN> --printer "RP58 Printer"
  # USB via COM di Windows
  python agent.py --url https://pos.domain.com --token <TOKEN> --com COM5
  # Bluetooth di Linux
  python agent.py --url https://pos.domain.com --token <TOKEN> --mac 66:32:5C:C4:3B:32

Dependency: hanya `pyserial` (untuk USB Windows; `pip install pyserial`).
HTTP & RFCOMM pakai stdlib.
"""

import argparse
import base64
import json
import os
import socket
import sys
import time
import urllib.error
import urllib.request

# Timeout HTTP long-poll harus > lama server menahan (25s) + margin.
POLL_HTTP_TIMEOUT = 35
ACK_HTTP_TIMEOUT = 15
RETRY_SLEEP = 3  # jeda saat backend tak terjangkau

# UA seperti browser: sebagian Cloudflare/WAF "Bot Fight Mode" memblokir default
# Python-urllib (403) sebelum request sampai ke backend. Header ini menekan blok itu.
USER_AGENT = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
              "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36")

_known_channel = None  # cache channel RFCOMM yang berhasil


def _send_via_com(port: str, payload: bytes) -> str:
    """Kirim ke printer via COM port (USB / Bluetooth outgoing Windows)."""
    try:
        import serial  # pyserial
        ser = serial.Serial(port=port, baudrate=9600, timeout=3, write_timeout=8)
        try:
            for i in range(0, len(payload), 180):
                ser.write(payload[i:i + 180])
                ser.flush()
                time.sleep(0.02)
            time.sleep(0.4)
        finally:
            ser.close()
        return port
    except ImportError:
        # Fallback tanpa pyserial: tulis mentah ke device COM (Windows).
        path = port if port.startswith("\\\\.\\") else ("\\\\.\\" + port)
        with open(path, "wb", buffering=0) as f:
            f.write(payload)
        return port


def _send_via_rfcomm(mac: str, payload: bytes) -> str:
    """Kirim ke printer via RFCOMM (Linux Bluetooth). Return 'MAC ch<n>'."""
    global _known_channel
    channels = [_known_channel] if _known_channel else []
    channels += [c for c in range(1, 7) if c not in channels]

    last_err = None
    for ch in channels:
        try:
            s = socket.socket(socket.AF_BLUETOOTH, socket.SOCK_STREAM, socket.BTPROTO_RFCOMM)
            s.settimeout(10)
            s.connect((mac, ch))
            try:
                for i in range(0, len(payload), 180):
                    s.send(payload[i:i + 180])
                    time.sleep(0.02)
                time.sleep(0.4)
            finally:
                s.close()
            _known_channel = ch
            return f"{mac} ch{ch}"
        except Exception as e:  # noqa: BLE001 - coba channel berikutnya
            last_err = e
            continue
    raise RuntimeError(f"Gagal kirim ke printer {mac}: {last_err}")


def _send_via_winspool(printer_name: str, payload: bytes) -> str:
    """Kirim RAW ESC/POS ke antrean printer Windows berdasarkan NAMA (spooler).

    Untuk printer USB yang muncul sebagai "Printer" Windows (port USB001 dll.) dan
    TAK punya COM port. Pakai ctypes -> winspool.drv, tanpa dependensi. Windows-only.
    """
    import ctypes
    from ctypes import wintypes

    winspool = ctypes.WinDLL("winspool.drv", use_last_error=True)

    class DOC_INFO_1(ctypes.Structure):
        _fields_ = [
            ("pDocName", wintypes.LPWSTR),
            ("pOutputFile", wintypes.LPWSTR),
            ("pDatatype", wintypes.LPWSTR),
        ]

    # argtypes/restype WAJIB: tanpa ini ctypes memangkas HANDLE ke 32-bit di Win64.
    winspool.OpenPrinterW.argtypes = [wintypes.LPWSTR, ctypes.POINTER(wintypes.HANDLE), wintypes.LPVOID]
    winspool.OpenPrinterW.restype = wintypes.BOOL
    winspool.StartDocPrinterW.argtypes = [wintypes.HANDLE, wintypes.DWORD, ctypes.POINTER(DOC_INFO_1)]
    winspool.StartDocPrinterW.restype = wintypes.DWORD
    winspool.StartPagePrinter.argtypes = [wintypes.HANDLE]
    winspool.StartPagePrinter.restype = wintypes.BOOL
    winspool.WritePrinter.argtypes = [wintypes.HANDLE, wintypes.LPVOID, wintypes.DWORD, ctypes.POINTER(wintypes.DWORD)]
    winspool.WritePrinter.restype = wintypes.BOOL
    winspool.EndPagePrinter.argtypes = [wintypes.HANDLE]
    winspool.EndPagePrinter.restype = wintypes.BOOL
    winspool.EndDocPrinter.argtypes = [wintypes.HANDLE]
    winspool.EndDocPrinter.restype = wintypes.BOOL
    winspool.ClosePrinter.argtypes = [wintypes.HANDLE]
    winspool.ClosePrinter.restype = wintypes.BOOL

    h = wintypes.HANDLE()
    if not winspool.OpenPrinterW(printer_name, ctypes.byref(h), None):
        raise RuntimeError(
            f"OpenPrinter '{printer_name}' gagal (err {ctypes.get_last_error()}). "
            "Cek NAMA printer persis seperti di Windows > Bluetooth & devices > Printers."
        )
    try:
        doc = DOC_INFO_1("Print Relay", None, "RAW")
        if not winspool.StartDocPrinterW(h, 1, ctypes.byref(doc)):
            raise RuntimeError(f"StartDocPrinter gagal (err {ctypes.get_last_error()}).")
        try:
            if not winspool.StartPagePrinter(h):
                raise RuntimeError(f"StartPagePrinter gagal (err {ctypes.get_last_error()}).")
            written = wintypes.DWORD(0)
            buf = ctypes.create_string_buffer(payload, len(payload))
            ok = winspool.WritePrinter(h, ctypes.cast(buf, wintypes.LPVOID), len(payload), ctypes.byref(written))
            if not ok or written.value != len(payload):
                raise RuntimeError(
                    f"WritePrinter gagal ({written.value}/{len(payload)} byte, "
                    f"err {ctypes.get_last_error()})."
                )
            winspool.EndPagePrinter(h)
        finally:
            winspool.EndDocPrinter(h)
    finally:
        winspool.ClosePrinter(h)
    return f"win:{printer_name}"


def _print_job(com: str, mac: str, printer: str, payload: bytes) -> str:
    if printer:
        return _send_via_winspool(printer, payload)
    if com:
        return _send_via_com(com, payload)
    return _send_via_rfcomm(mac, payload)


def _poll(url: str, token: str):
    """GET /printer-relay/poll - kembalikan job dict atau None (timeout normal)."""
    req = urllib.request.Request(
        url + "/printer-relay/poll",
        headers={"x-printer-token": token, "user-agent": USER_AGENT},
    )
    with urllib.request.urlopen(req, timeout=POLL_HTTP_TIMEOUT) as r:
        data = json.loads(r.read().decode("utf-8"))
    return data.get("job")


def _ack(url: str, token: str, job_id: str, ok: bool, target: str = "", error: str = ""):
    body = json.dumps({"jobId": job_id, "ok": ok, "target": target, "error": error}).encode()
    req = urllib.request.Request(
        url + "/printer-relay/ack",
        data=body,
        headers={"x-printer-token": token, "content-type": "application/json",
                 "user-agent": USER_AGENT},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=ACK_HTTP_TIMEOUT) as r:
            r.read()
    except Exception as e:  # noqa: BLE001 - ack gagal bukan fatal, job lain jalan
        print(f"[agent] ack gagal (job {job_id[:8]}): {e}", file=sys.stderr)


def _report_http_error(e: urllib.error.HTTPError, url: str) -> None:
    """Cetak diagnosa kaya saat poll ditolak - bedakan TOKEN (backend 401) vs
    BLOKIR PROXY/Cloudflare (403/HTML) supaya tak salah kira soal token."""
    server = ""
    cf_ray = ""
    try:
        server = (e.headers.get("Server", "") or "")
        cf_ray = (e.headers.get("CF-RAY", "") or "")
    except Exception:  # noqa: BLE001
        pass
    body = ""
    try:
        raw = e.read(500)
        body = raw.decode("utf-8", "replace").strip().replace("\n", " ")[:300]
    except Exception:  # noqa: BLE001
        pass

    looks_proxy = ("cloudflare" in server.lower() or bool(cf_ray)
                   or "<html" in body.lower() or "<!doctype" in body.lower())

    if e.code == 401 and not looks_proxy:
        print("[agent] TOKEN DITOLAK backend (401). Token salah / device dinonaktifkan - "
              "download ulang .bat dari Settings > Printer.", file=sys.stderr)
    elif e.code == 403 or looks_proxy:
        print("[agent] DIBLOKIR proxy/Cloudflare (bukan soal token). Izinkan path "
              "/printer-relay/* di Cloudflare/WAF (mis. matikan Bot Fight Mode utk path ini) "
              "atau arahkan URL agen langsung ke backend.", file=sys.stderr)
    else:
        print(f"[agent] HTTP {e.code} saat poll - coba lagi.", file=sys.stderr)

    print(f"[agent] detail: HTTP {e.code}  url={url}/printer-relay/poll  "
          f"server={server or '-'}  cf-ray={cf_ray or '-'}", file=sys.stderr)
    if body:
        print(f"[agent] body: {body}", file=sys.stderr)


def run(url: str, token: str, com: str, mac: str, printer: str):
    target_label = printer or com or mac
    where_desc = ('WinPrinter ' + printer) if printer else ('USB ' + com if com else 'BT ' + mac)
    print(f"[agent] mulai - backend={url}  printer={where_desc}")
    print("[agent] menunggu job cetak... (Ctrl+C untuk berhenti)")
    while True:
        try:
            job = _poll(url, token)
        except urllib.error.HTTPError as e:
            _report_http_error(e, url)
            time.sleep(RETRY_SLEEP)
            continue
        except (urllib.error.URLError, socket.timeout, TimeoutError):
            # Timeout long-poll normal (tak ada job) ATAU backend sesaat tak
            # terjangkau. Loop lagi; kalau memang down, jeda pendek.
            time.sleep(1)
            continue
        except Exception as e:  # noqa: BLE001
            print(f"[agent] error poll: {e} - coba lagi.", file=sys.stderr)
            time.sleep(RETRY_SLEEP)
            continue

        if not job:
            continue  # timeout normal, poll lagi

        job_id = job.get("jobId", "")
        try:
            payload = base64.b64decode(job.get("dataBase64", ""))
            where = _print_job(com, mac, printer, payload)
            print(f"[agent] cetak OK job {job_id[:8]} -> {where} ({len(payload)} byte)")
            _ack(url, token, job_id, True, target=str(where))
        except Exception as e:  # noqa: BLE001
            print(f"[agent] cetak GAGAL job {job_id[:8]}: {e}", file=sys.stderr)
            _ack(url, token, job_id, False, target=str(target_label), error=str(e))


def main():
    ap = argparse.ArgumentParser(description="Print Relay Agent (long-poll -> printer USB/Bluetooth)")
    ap.add_argument("--url", default=os.environ.get("AGENT_URL", ""),
                    help="Base URL backend, mis. https://pos.domain.com")
    ap.add_argument("--token", default=os.environ.get("PRINTER_TOKEN", ""),
                    help="Token perangkat dari Settings > Printer")
    ap.add_argument("--com", default=os.environ.get("PRINTER_COM", ""),
                    help="USB/Bluetooth COM port (Windows), mis. COM5")
    ap.add_argument("--mac", default=os.environ.get("PRINTER_MAC", ""),
                    help="MAC printer Bluetooth (Linux RFCOMM)")
    ap.add_argument("--printer", default=os.environ.get("PRINTER_NAME", ""),
                    help='Nama printer Windows (spooler RAW), mis. "RP58 Printer"')
    args = ap.parse_args()

    url = args.url.strip().rstrip("/")
    token = args.token.strip()
    com = args.com.strip()
    mac = args.mac.strip()
    printer = args.printer.strip()

    if not url or not token:
        print("ERROR: wajib --url dan --token (atau env AGENT_URL / PRINTER_TOKEN).", file=sys.stderr)
        sys.exit(2)
    if not com and not mac and not printer:
        print('ERROR: pilih target printer - Windows: --printer "Nama" | '
              "USB(COM): --com COM5 | Bluetooth: --mac <MAC>.", file=sys.stderr)
        sys.exit(2)

    try:
        run(url, token, com, mac, printer)
    except KeyboardInterrupt:
        print("\n[agent] berhenti.")


if __name__ == "__main__":
    main()
