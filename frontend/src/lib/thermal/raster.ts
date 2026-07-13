// frontend/src/lib/thermal/raster.ts
import { BYTES_PER_ROW, PRINTER_DOTS } from './escpos';

/**
 * Konversi ImageData (harus selebar PRINTER_DOTS) → buffer 1-bit.
 * Piksel gelap (luminance < threshold) dengan alpha cukup tergolong "hitam".
 * Latar transparan dianggap putih.
 */
export const imageDataToMono = (
  img: { width: number; height: number; data: Uint8ClampedArray },
  threshold = 160,
): { mono: Uint8Array; height: number } => {
  const { width, height, data } = img;
  if (width !== PRINTER_DOTS) {
    throw new Error(`Lebar ImageData harus ${PRINTER_DOTS}px, dapat ${width}px`);
  }
  const mono = new Uint8Array(BYTES_PER_ROW * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const a = data[i + 3];
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const black = a > 32 && lum < threshold;
      if (black) {
        const byteIndex = y * BYTES_PER_ROW + (x >> 3);
        mono[byteIndex] |= 0x80 >> (x & 7); // MSB-first, sesuai GS v 0
      }
    }
  }
  return { mono, height };
};
