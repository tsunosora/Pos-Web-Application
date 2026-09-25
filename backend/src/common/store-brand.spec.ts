/**
 * Penjaga: merek satu klien TIDAK BOLEH tertanam di kode (T-34).
 *
 * Aplikasi ini dipasang satu instance per klien, jadi nama toko, alamat, telepon,
 * dan logo wajib datang dari Profil Toko (StoreSettings / GET /settings/public).
 * Dulu merek satu klien tertulis mati di kop PDF, struk, footer, dan prompt asisten
 * AI — setiap pemasangan baru ikut menampilkan merek itu.
 *
 * Tes ini murni: baca berkas + satu fungsi template, tanpa database & tanpa jaringan.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildPiketPdfHtml,
  type PiketPdfInput,
} from '../task-board/piket-pdf.template';

/** Input paling minim — yang diuji cuma kop kertasnya. */
const inputKosong = (storeLabel?: string): PiketPdfInput => ({
  storeLabel,
  dateKey: '2026-09-26',
  trialUntil: null,
  shiftTasks: [],
  shiftMembers: [],
  groupTasks: [],
  rotationTasks: [],
  rotation: null,
  remindBeforeMin: 10,
  graceMin: 5,
});

describe('kop dokumen mengambil nama toko dari Profil Toko, bukan konstanta', () => {
  it('nama dari Profil Toko muncul di kop kedua halaman', () => {
    const html = buildPiketPdfHtml(inputKosong('Toko Budi · Cabang Sewon'));
    // Dua halaman = dua kop, dua-duanya pakai label yang dikirim pemanggil.
    const muncul = html.split('TOKO BUDI · CABANG SEWON').length - 1;
    expect(muncul).toBe(2);
  });

  it('nama toko lain tidak bocor ke kop toko ini', () => {
    const html = buildPiketPdfHtml(inputKosong('Warung Sari'));
    expect(html).toContain('WARUNG SARI');
    expect(html).not.toMatch(/voliko/i);
  });

  it('Profil Toko belum diisi → fallback netral, bukan nama klien', () => {
    const html = buildPiketPdfHtml(inputKosong(undefined));
    expect(html).toContain('<small>TOKO</small>');
    expect(html).not.toMatch(/voliko/i);
  });
});

/** Kumpulkan berkas sumber yang IKUT DIKIRIM ke klien. */
function berkasSumber(akar: string): string[] {
  const hasil: string[] = [];
  const lewati = new Set(['node_modules', '.next', 'dist', 'coverage']);
  const jelajah = (dir: string) => {
    let isi: string[];
    try {
      isi = readdirSync(dir);
    } catch {
      return; // folder tidak ada di lingkungan ini → lewati saja
    }
    for (const nama of isi) {
      if (lewati.has(nama)) continue;
      const p = join(dir, nama);
      if (statSync(p).isDirectory()) jelajah(p);
      else if (/\.(ts|tsx|js|jsx)$/.test(nama) && !nama.endsWith('store-brand.spec.ts')) hasil.push(p);
    }
  };
  jelajah(akar);
  return hasil;
}

describe('sumber yang dikirim ke klien bebas data satu klien', () => {
  // __dirname = backend/src/common
  const backendSrc = join(__dirname, '..');
  const frontendSrc = join(__dirname, '..', '..', '..', 'frontend', 'src');
  const berkas = [...berkasSumber(backendSrc), ...berkasSumber(frontendSrc)];

  it('kedua pohon sumber benar-benar terbaca (biar tes ini tidak lulus karena kosong)', () => {
    // Per 26 Sep 2026: backend/src 332 berkas, frontend/src 328. Ambang di bawah
    // jumlah backend saja, supaya jalur frontend yang putus ikut ketangkap —
    // bukan lulus diam-diam karena cuma separuh pohon yang diperiksa.
    expect(berkasSumber(backendSrc).length).toBeGreaterThan(200);
    expect(berkasSumber(frontendSrc).length).toBeGreaterThan(200);
  });

  it('nama klien tidak tertanam di kode', () => {
    const kena = berkas.filter((f) => /voliko/i.test(readFileSync(f, 'utf8')));
    expect(kena).toEqual([]);
  });

  it('nomor WhatsApp pribadi tidak tertanam di kode', () => {
    // Nomor dukungan dibaca dari env SUPPORT_WA, jadi tiap pemasangan punya sendiri.
    const kena = berkas.filter((f) => /89669180127/.test(readFileSync(f, 'utf8')));
    expect(kena).toEqual([]);
  });
});
