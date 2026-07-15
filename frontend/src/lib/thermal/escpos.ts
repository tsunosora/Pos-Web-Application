// frontend/src/lib/thermal/escpos.ts
// Encoder ESC/POS minimal untuk printer thermal 55mm (area cetak 48mm, 376 dot efektif).
// Semua fungsi PURE: input angka/array → Uint8Array. Tidak menyentuh DOM/Bluetooth.

// Kertas 55mm, area cetak 48mm. 48mm @203dpi ≈ 384 dot (mepet tepi, tanpa margin →
// kolom kanan rawan terpotong). Pakai 376 dot (47mm) agar ada ~1mm margin aman.
export const PRINTER_DOTS = 376; // lebar cetak efektif (47mm dari area cetak 48mm)
export const BYTES_PER_ROW = PRINTER_DOTS / 8; // 47

const ESC = 0x1b;
const GS = 0x1d;

/** ESC @ — reset printer ke kondisi awal. */
export const initPrinter = (): Uint8Array => new Uint8Array([ESC, 0x40]);

/** Umpan n baris kosong lalu (opsional) potong kertas. */
export const feedAndCut = (lines = 4): Uint8Array => {
  const feed = [ESC, 0x64, lines & 0xff]; // ESC d n
  const cut = [GS, 0x56, 0x00]; // GS V 0 (full cut; printer tanpa cutter mengabaikannya)
  return new Uint8Array([...feed, ...cut]);
};

/** Gabungkan beberapa Uint8Array jadi satu buffer. */
export const concatBytes = (...parts: Uint8Array[]): Uint8Array => {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
};

/**
 * Bangun perintah GS v 0 (raster bit image) dari buffer 1-bit.
 * @param mono  Uint8Array berukuran BYTES_PER_ROW * height; bit 1 = titik hitam.
 * @param height jumlah baris (dot).
 * @param bandRows dipecah per band agar kompatibel printer murah + payload BLE kecil.
 */
export const rasterImage = (mono: Uint8Array, height: number, bandRows = 128): Uint8Array => {
  const parts: Uint8Array[] = [];
  for (let y = 0; y < height; y += bandRows) {
    const rows = Math.min(bandRows, height - y);
    const header = new Uint8Array([
      GS,
      0x76,
      0x30,
      0x00, // GS v 0, mode 0 (normal)
      BYTES_PER_ROW & 0xff,
      (BYTES_PER_ROW >> 8) & 0xff, // xL, xH (bytes/row)
      rows & 0xff,
      (rows >> 8) & 0xff, // yL, yH (jumlah baris band)
    ]);
    const slice = mono.subarray(y * BYTES_PER_ROW, (y + rows) * BYTES_PER_ROW);
    parts.push(header, slice);
  }
  return concatBytes(...parts);
};
