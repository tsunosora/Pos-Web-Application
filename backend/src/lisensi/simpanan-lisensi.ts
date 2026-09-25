/**
 * Tempat menyimpan kunci lisensi di instalasi klien.
 *
 * Kenapa BERKAS, bukan tabel database:
 * - Repo ini belum punya riwayat migrasi Prisma (deploy masih `db push`), jadi menambah tabel
 *   berarti menuntut satu langkah tangan di tiap instalasi yang sudah jalan — termasuk Voliko.
 * - Kunci harus bisa dibaca SEBELUM dan TANPA database. Kalau MySQL mati, aplikasi memang tak
 *   bisa apa-apa, tapi penyegaran saat boot dan pembacaan keadaan lisensi tidak boleh ikut
 *   gagal hanya karena database belum siap — nanti gejalanya tertukar.
 * - Ada presedennya di repo ini: `storage/studio-ai-config.json` (lihat studio-ai.service.ts),
 *   dan folder `storage/` sudah masuk .gitignore, jadi kunci klien tidak pernah ikut ter-commit.
 *
 * Kunci lisensi BUKAN rahasia (isinya bertanda tangan, bukan kredensial) — yang rahasia adalah
 * token instalasi, dan itu tinggal di `.env`. Tetap ditulis dengan izin 600 supaya tidak
 * sembarang pengguna server bisa menyalinnya ke pemasangan lain.
 */
import { promises as fs } from 'node:fs';
import { dirname, join } from 'node:path';

export interface Simpanan {
    /** Kunci `q1.<isi>.<tanda tangan>`, apa adanya seperti yang dikirim qendali.com. */
    kunci: string | null;
    /** Stempel UTC penyegaran TERAKHIR YANG BERHASIL — penangkal jam mesin yang dimundurkan. */
    terakhirTerlihat: string | null;
    /** Stempel percobaan terakhir (berhasil atau tidak), untuk menebak kenapa kunci basi. */
    terakhirDicoba: string | null;
    /** Hasil percobaan terakhir dalam bahasa manusia, mis. "403 langganan_berhenti". */
    catatanTerakhir: string | null;
}

export const SIMPANAN_KOSONG: Simpanan = {
    kunci: null,
    terakhirTerlihat: null,
    terakhirDicoba: null,
    catatanTerakhir: null,
};

/** Berkas simpanan: env `QENDALI_LISENSI_BERKAS`, atau `<backend>/storage/lisensi-qendali.json`. */
export function berkasLisensi(): string {
    const dariEnv = (process.env.QENDALI_LISENSI_BERKAS ?? '').trim();
    if (dariEnv) return dariEnv;
    return join(process.cwd(), 'storage', 'lisensi-qendali.json');
}

/** Baca simpanan. Berkas tidak ada / rusak = dianggap kosong (gagal-terbuka), bukan galat. */
export async function bacaSimpanan(berkas = berkasLisensi()): Promise<Simpanan> {
    try {
        const isi = JSON.parse(await fs.readFile(berkas, 'utf8')) as Partial<Simpanan>;
        return {
            kunci: typeof isi.kunci === 'string' && isi.kunci.trim() ? isi.kunci.trim() : null,
            terakhirTerlihat: typeof isi.terakhirTerlihat === 'string' ? isi.terakhirTerlihat : null,
            terakhirDicoba: typeof isi.terakhirDicoba === 'string' ? isi.terakhirDicoba : null,
            catatanTerakhir: typeof isi.catatanTerakhir === 'string' ? isi.catatanTerakhir : null,
        };
    } catch {
        return { ...SIMPANAN_KOSONG };
    }
}

/** Tulis simpanan. Gagal menulis tidak boleh menjatuhkan aplikasi — pemanggil cukup mencatat log. */
export async function tulisSimpanan(isi: Simpanan, berkas = berkasLisensi()): Promise<void> {
    await fs.mkdir(dirname(berkas), { recursive: true });
    await fs.writeFile(berkas, JSON.stringify(isi, null, 2), { encoding: 'utf8', mode: 0o600 });
}
