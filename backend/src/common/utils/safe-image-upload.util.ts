import { BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sharp: (input: string) => import('sharp').Sharp = require('sharp');

/**
 * Unggahan gambar yang aman untuk endpoint tanpa login akun (papan kerja, SO desainer).
 * Ekstensi berkas DITENTUKAN SERVER dari tipe gambar, bukan dari nama asli kiriman
 * klien. Dulu `foto.html` berlabel image/png tersimpan sebagai .html lalu tersaji
 * sebagai halaman web dari domain toko (T-18). SVG sengaja ditolak (bisa berisi skrip).
 */
const EXT_BY_MIME: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/pjpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/heic': '.heic',
    'image/heif': '.heif',
};

export function safeImageExt(mime?: string | null): string | null {
    return EXT_BY_MIME[String(mime ?? '').toLowerCase()] ?? null;
}

/** fileFilter multer: hanya tipe gambar di daftar putih. */
export function safeImageFilter(_req: any, file: any, cb: (err: Error | null, ok: boolean) => void) {
    if (!safeImageExt(file?.mimetype)) {
        return cb(new BadRequestException('Hanya foto JPG, PNG, WEBP, GIF, atau HEIC yang diperbolehkan'), false);
    }
    cb(null, true);
}

/** Setelah tersimpan: pastikan isinya benar-benar gambar. Kalau bukan → hapus & tolak. */
export async function assertRealImage(filePath: string): Promise<void> {
    // HEIC/HEIF (foto iPhone) belum tentu terbaca sharp; tetap aman karena disajikan
    // sebagai image/heic + nosniff, jadi tidak akan pernah dijalankan sebagai halaman.
    if (/\.(heic|heif)$/i.test(filePath)) return;
    try {
        const meta = await sharp(filePath).metadata();
        if (meta?.format && meta.format !== 'svg') return;
    } catch { /* bukan gambar yang bisa dibaca */ }
    try { fs.unlinkSync(filePath); } catch { /* ignore */ }
    throw new BadRequestException('Berkas bukan gambar yang valid');
}

/** Hapus berkas yang terlanjur tersimpan multer (mis. PIN ternyata salah). */
export function discardUpload(file?: { path?: string } | null) {
    if (file?.path) try { fs.unlinkSync(file.path); } catch { /* ignore */ }
}
