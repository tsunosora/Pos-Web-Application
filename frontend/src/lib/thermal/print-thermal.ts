// frontend/src/lib/thermal/print-thermal.ts
// Orkestrator cetak thermal: snap → canvas → raster → kirim BT; plus fallback browser-print.
import html2canvas from 'html2canvas';
import type { ReceiptSnapshot } from '../receipt';
import { buildThermalReceiptHTML } from './receipt-thermal';
import { imageDataToMono } from './raster';
import { concatBytes, feedAndCut, initPrinter, rasterImage, PRINTER_DOTS } from './escpos';
import { ensureConnected, sendBytes } from './bluetooth';
import api from '../api/client';
import { isDesktop, printEscposDesktop, printEscposDesktopWith, type ElectronPrinterConfig } from './desktop-bridge';

type Status = 'TAGIHAN' | 'LUNAS';

/**
 * Render struk ke <canvas> selebar 384px lewat IFRAME terisolasi.
 * Iframe punya dokumen sendiri (tanpa CSS Tailwind app), jadi html2canvas 1.4.1
 * tak pernah ketemu warna `oklch()`/`lab()` (yang di-parse jadi transparan →
 * struk bisa kosong). Dulu di-inject ke document.body → mewarisi warna app.
 */
const renderToCanvas = async (snap: ReceiptSnapshot, status: Status): Promise<HTMLCanvasElement> => {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:absolute;left:-99999px;top:0;width:400px;height:100px;border:0;background:#fff;';
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  if (!doc) {
    document.body.removeChild(iframe);
    throw new Error('Gagal menyiapkan kanvas struk.');
  }
  doc.open();
  doc.write(buildThermalReceiptHTML(snap, status));
  doc.close();
  const target = doc.querySelector('.receipt') as HTMLElement;
  // Tunggu semua gambar (logo) selesai load agar tak ter-render kosong.
  await Promise.all(
    Array.from(doc.querySelectorAll('img')).map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise((r) => {
            img.onload = img.onerror = () => r(null);
          }),
    ),
  );
  try {
    // Kanvas TEPAT 384px (scale 1). Jangan supersample: scale>1 melipatgandakan luas
    // kanvas (768×2H = 4×) & bisa menembus batas ukuran kanvas di tablet/HP POS murah
    // → bagian bawah gagal ter-render / terpotong. Ketebalan teks ditangani via CSS
    // (bold + ukuran lebih besar) + ambang mono, bukan lewat perbesaran kanvas.
    return await html2canvas(target, {
      width: PRINTER_DOTS,
      backgroundColor: '#fff',
      scale: 1,
      useCORS: true,
    });
  } finally {
    document.body.removeChild(iframe);
  }
};

/** Render snap → byte ESC/POS raster (dipakai internal). */
const snapToEscpos = async (snap: ReceiptSnapshot, status: Status): Promise<Uint8Array> => {
  const canvas = await renderToCanvas(snap, status);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Gagal membuat gambar struk.');
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { mono, height } = imageDataToMono(img, 170);
  return concatBytes(initPrinter(), rasterImage(mono, height), feedAndCut());
};

/** Cetak thermal ke printer desktop TERTENTU (mode Electron), bukan config default.
 *  Dipakai menu cetak agar kasir bisa memilih printer per cetak (tak terkunci 1). */
export const printThermalDesktopTo = async (
  snap: ReceiptSnapshot,
  status: Status,
  cfg: ElectronPrinterConfig,
): Promise<void> => {
  const b64 = bytesToBase64(await snapToEscpos(snap, status));
  await printEscposDesktopWith(b64, cfg);
};

/** Cetak via printer Bluetooth (Android/Chrome). Printer harus sudah connect. */
export const printThermalBluetooth = async (snap: ReceiptSnapshot, status: Status): Promise<void> => {
  await sendBytes(await snapToEscpos(snap, status));
};

/**
 * Cetak 1-tap: pastikan koneksi (pakai printer tersimpan bila ada, tanpa dialog),
 * baru kirim. Harus dipanggil dari gesture user (onClick) agar fallback dialog boleh muncul.
 * Koneksi SENGAJA dibiarkan hidup setelah cetak: printer thermal BLE murah (RPP02N)
 * sering GAGAL di-connect ulang tepat setelah baru saja diputus (bonded/half-held),
 * sehingga cetak ulang di device yang sama macet ("paired terus") padahal device
 * bersih mulus. Kebutuhan "1 printer dipakai bergantian banyak device" ditangani
 * oleh print bridge / print server LAN, bukan dengan melepas koneksi BLE tiap cetak.
 * Bila printer benar-benar putus (idle/timeout), listener `gattserverdisconnected`
 * mereset state → `ensureConnected()` menyambung ulang otomatis di cetak berikutnya.
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
// Default: env NEXT_PUBLIC_BRIDGE_URL (mis. print server LAN dipakai banyak kasir),
// jatuh ke localhost bila tak diset. localStorage tetap bisa override per-device.
const DEFAULT_BRIDGE_URL = process.env.NEXT_PUBLIC_BRIDGE_URL || 'http://127.0.0.1:9100';

/**
 * URL bridge. Prioritas: localStorage `thermalPrinter.bridgeUrl` (override per-device)
 * → env `NEXT_PUBLIC_BRIDGE_URL` (setelan global) → `http://127.0.0.1:9100`.
 */
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

// --- Print Relay (via backend, satu origin https) ---
// Jalur andal untuk https + banyak device: byte ESC/POS dikirim ke backend, lalu
// diteruskan ke agen (komputer utama cabang) yang colok printer USB/Bluetooth.
// Tak kena mixed-content (semua lewat aplikasi https), tanpa pairing per-device.

/** Uint8Array → base64 (browser, aman untuk data besar). */
const bytesToBase64 = (bytes: Uint8Array): string => {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
};

/** Cek apakah printer server (relay) cabang ini online. Butuh login (JWT). */
export const isRelayAvailable = async (): Promise<boolean> => {
  try {
    const { data } = await api.get('/printer-relay/status');
    return !!data?.online;
  } catch {
    return false;
  }
};

/** Cetak via print relay: render byte ESC/POS → kirim ke backend → agen cabang. */
export const printThermalViaRelay = async (snap: ReceiptSnapshot, status: Status): Promise<void> => {
  const bytes = await snapToEscpos(snap, status);
  const b64 = bytesToBase64(bytes);
  // Di aplikasi desktop (Electron): cetak langsung ke printer lokal via IPC —
  // tanpa agen relay/agent.py/.bat. Browser biasa tetap lewat relay.
  if (isDesktop()) {
    await printEscposDesktop(b64);
    return;
  }
  try {
    await api.post('/printer-relay/jobs', { dataBase64: b64 });
  } catch (e: unknown) {
    const msg =
      (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
      'Gagal mencetak via printer server.';
    throw new Error(msg);
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
