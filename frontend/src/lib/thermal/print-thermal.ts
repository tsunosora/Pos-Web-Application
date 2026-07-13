// frontend/src/lib/thermal/print-thermal.ts
// Orkestrator cetak thermal: snap → canvas → raster → kirim BT; plus fallback browser-print.
import html2canvas from 'html2canvas';
import type { ReceiptSnapshot } from '../receipt';
import { buildThermalReceiptBody, buildThermalReceiptHTML, THERMAL_CSS } from './receipt-thermal';
import { imageDataToMono } from './raster';
import { concatBytes, feedAndCut, initPrinter, rasterImage, PRINTER_DOTS } from './escpos';
import { ensureConnected, sendBytes } from './bluetooth';

type Status = 'TAGIHAN' | 'LUNAS';

/** Render body struk ke <canvas> selebar 384px lewat DOM tersembunyi. */
const renderToCanvas = async (snap: ReceiptSnapshot, status: Status): Promise<HTMLCanvasElement> => {
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;left:-99999px;top:0;background:#fff;';
  host.innerHTML = `<style>${THERMAL_CSS}</style>${buildThermalReceiptBody(snap, status)}`;
  document.body.appendChild(host);
  const target = host.querySelector('.receipt') as HTMLElement;
  // Tunggu semua gambar (logo) selesai load agar tak ter-render kosong.
  await Promise.all(
    Array.from(host.querySelectorAll('img')).map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise((r) => {
            img.onload = img.onerror = () => r(null);
          }),
    ),
  );
  try {
    return await html2canvas(target, {
      width: PRINTER_DOTS,
      backgroundColor: '#fff',
      scale: 1,
      useCORS: true,
    });
  } finally {
    document.body.removeChild(host);
  }
};

/** Render snap → byte ESC/POS raster (dipakai internal). */
const snapToEscpos = async (snap: ReceiptSnapshot, status: Status): Promise<Uint8Array> => {
  const canvas = await renderToCanvas(snap, status);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Gagal membuat gambar struk.');
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { mono, height } = imageDataToMono(img);
  return concatBytes(initPrinter(), rasterImage(mono, height), feedAndCut());
};

/** Cetak via printer Bluetooth (Android/Chrome). Printer harus sudah connect. */
export const printThermalBluetooth = async (snap: ReceiptSnapshot, status: Status): Promise<void> => {
  await sendBytes(await snapToEscpos(snap, status));
};

/**
 * Cetak 1-tap: pastikan koneksi (pakai printer tersimpan bila ada, tanpa dialog),
 * baru kirim. Harus dipanggil dari gesture user (onClick) agar fallback dialog boleh muncul.
 * @returns nama printer yang dipakai.
 */
export const printThermalBluetoothAuto = async (
  snap: ReceiptSnapshot,
  status: Status,
): Promise<string> => {
  // Siapkan byte dulu (paralel dgn kemungkinan reconnect) lalu kirim.
  const [bytes, name] = await Promise.all([snapToEscpos(snap, status), ensureConnected()]);
  await sendBytes(bytes);
  return name;
};

/** Fallback: buka window & window.print() dengan @page 58mm (iOS/Windows). */
export const printThermalViaBrowser = (snap: ReceiptSnapshot, status: Status): void => {
  const win = window.open('', '_blank', 'width=320,height=800');
  if (!win) return;
  win.document.write(buildThermalReceiptHTML(snap, status));
  win.document.close();
  win.focus();
  win.print();
};

// --- Print Bridge (Linux/desktop): HTTP -> Bluetooth SPP ---
// Di Linux, Web Bluetooth (BLE) sering gagal ambil alih printer dual-mode yang
// dipegang BlueZ di mode Classic (SPP). Bridge lokal (tools/print-bridge/bridge.py)
// menerima byte ESC/POS via HTTP lalu meneruskan ke printer via RFCOMM.

const BRIDGE_LS_KEY = 'thermalPrinter.bridgeUrl';
const DEFAULT_BRIDGE_URL = 'http://127.0.0.1:9100';

/** URL bridge; bisa dioverride via localStorage `thermalPrinter.bridgeUrl`. */
export const getBridgeUrl = (): string => {
  try {
    return localStorage.getItem(BRIDGE_LS_KEY) || DEFAULT_BRIDGE_URL;
  } catch {
    return DEFAULT_BRIDGE_URL;
  }
};

/** Cek apakah bridge lokal aktif (GET /health) dengan timeout pendek. */
export const isBridgeAvailable = async (timeoutMs = 1200): Promise<boolean> => {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${getBridgeUrl()}/health`, { signal: ctrl.signal });
    if (!res.ok) return false;
    const data = await res.json();
    return !!data?.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
};

/** Cetak lewat bridge lokal: render byte ESC/POS lalu POST ke bridge. */
export const printThermalViaBridge = async (snap: ReceiptSnapshot, status: Status): Promise<void> => {
  const bytes = await snapToEscpos(snap, status);
  // Salin ke ArrayBuffer murni — hindari tipe Uint8Array<ArrayBufferLike> (bisa SharedArrayBuffer)
  // yang tak diterima BodyInit di lib TS terbaru.
  const buf = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buf).set(bytes);
  const res = await fetch(`${getBridgeUrl()}/print`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: buf,
  });
  if (!res.ok) {
    let detail = '';
    try {
      detail = (await res.json())?.error || '';
    } catch {
      /* ignore */
    }
    throw new Error(detail || `Bridge menolak (HTTP ${res.status}).`);
  }
};
