// eslint-disable-next-line @typescript-eslint/no-require-imports
const sharp: (input: string) => import('sharp').Sharp = require('sharp');
import * as path from 'path';
import * as fs from 'fs';

const MAX_DIMENSION = 1600;
const JPEG_QUALITY  = 80;
const WEBP_QUALITY  = 80;
const PNG_QUALITY   = 80;

// Ekstensi yang BOLEH dikompres. SVG (vektor), GIF (animasi), dan BMP
// dilewati — re-encode bisa merusak konten / membuat isi tak cocok ekstensi.
const COMPRESSIBLE = new Set(['.jpg', '.jpeg', '.jfif', '.png', '.webp']);

/**
 * Kompres gambar di tempat (in-place, nama file tetap): resize maks 1600px
 * + re-encode kualitas ~80. Best-effort — kalau sharp gagal (file korup) atau
 * hasil kompresi malah lebih besar, file asli dipertahankan dan TIDAK throw,
 * supaya upload tidak pernah gagal gara-gara kompresi.
 */
export async function compressImage(filePath: string): Promise<void> {
  const tmpPath = filePath + '.tmp';
  try {
    const ext = path.extname(filePath).toLowerCase();
    if (!COMPRESSIBLE.has(ext)) return;

    const originalSize = fs.statSync(filePath).size;
    const image = sharp(filePath).rotate(); // auto-fix EXIF orientation

    const meta = await image.metadata();
    const needsResize =
      (meta.width && meta.width > MAX_DIMENSION) ||
      (meta.height && meta.height > MAX_DIMENSION);

    if (needsResize) {
      image.resize(MAX_DIMENSION, MAX_DIMENSION, { fit: 'inside', withoutEnlargement: true });
    }

    if (ext === '.png') {
      image.png({ quality: PNG_QUALITY, compressionLevel: 9 });
    } else if (ext === '.webp') {
      image.webp({ quality: WEBP_QUALITY });
    } else {
      // .jpg / .jpeg / .jfif
      image.jpeg({ quality: JPEG_QUALITY, mozjpeg: true });
    }

    await image.toFile(tmpPath);

    // Pakai hasil hanya kalau benar-benar lebih kecil — file yang sudah
    // teroptimasi tidak perlu ditulis ulang.
    const newSize = fs.statSync(tmpPath).size;
    if (newSize < originalSize) {
      fs.renameSync(tmpPath, filePath);
    } else {
      fs.unlinkSync(tmpPath);
    }
  } catch {
    // Gagal kompres → biarkan file asli apa adanya
    try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch { /* ignore */ }
  }
}

/** Kompres banyak file sekaligus (paralel, best-effort per file). */
export async function compressImages(filePaths: string[]): Promise<void> {
  await Promise.all((filePaths || []).filter(Boolean).map(p => compressImage(p)));
}
