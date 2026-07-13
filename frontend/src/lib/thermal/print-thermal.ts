// frontend/src/lib/thermal/print-thermal.ts
// Orkestrator cetak thermal: snap → canvas → raster → kirim BT; plus fallback browser-print.
import html2canvas from 'html2canvas';
import type { ReceiptSnapshot } from '../receipt';
import { buildThermalReceiptBody, buildThermalReceiptHTML, THERMAL_CSS } from './receipt-thermal';
import { imageDataToMono } from './raster';
import { concatBytes, feedAndCut, initPrinter, rasterImage, PRINTER_DOTS } from './escpos';
import { sendBytes } from './bluetooth';

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

/** Cetak via printer Bluetooth (Android/Chrome). Printer harus sudah connect. */
export const printThermalBluetooth = async (snap: ReceiptSnapshot, status: Status): Promise<void> => {
  const canvas = await renderToCanvas(snap, status);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Gagal membuat gambar struk.');
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { mono, height } = imageDataToMono(img);
  await sendBytes(concatBytes(initPrinter(), rasterImage(mono, height), feedAndCut()));
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
