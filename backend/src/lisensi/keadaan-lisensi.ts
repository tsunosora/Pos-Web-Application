/**
 * Menyimpulkan "keadaan lisensi" aplikasi dari kunci tersimpan — MURNI, tanpa fs/jaringan/DB,
 * supaya aturan yang paling menentukan bisa diuji sampai pojok-pojoknya.
 *
 * ┌─────────────────────────────────────────────────────────────────────────────────────┐
 * │ ATURAN PALING PENTING: GAGAL-TERBUKA.                                               │
 * │                                                                                     │
 * │ Kalau TIDAK ADA kunci tersimpan, aplikasi berjalan seperti sebelum penegakan ini     │
 * │ ada: SEMUA TERBUKA, cuma menulis peringatan di log. Penegakan menyala HANYA kalau    │
 * │ memang ada kunci.                                                                   │
 * │                                                                                     │
 * │ Kenapa: instalasi Voliko sudah jalan produksi di kasir tiap hari, dan belum pegang   │
 * │ kunci apa pun. Begitu juga tiap lingkungan pengembangan dan tiap tes. Kalau kode     │
 * │ ini gagal-tertutup, satu deploy bisa mengunci kasir yang sedang melayani pelanggan   │
 * │ karena alasan yang sama sekali bukan urusan kasir. Penegakan lisensi tidak boleh     │
 * │ pernah jadi sebab kasir mati.                                                        │
 * │                                                                                     │
 * │ Token tanpa kunci (mis. penyegaran pertama belum berhasil) juga tetap TERBUKA —      │
 * │ jangan sampai pemasangan baru terkunci gara-gara internet klien putus di hari        │
 * │ pertama. Kunci yang ada tapi tidak sah/kedaluwarsa BARU membuatnya hanya-baca.       │
 * └─────────────────────────────────────────────────────────────────────────────────────┘
 */
import {
    IsiKunci,
    KunciPublik,
    batasFitur,
    periksaKunci,
    punyaFitur,
    statusMasaBerlaku,
} from './periksa-kunci';

/** Produk yang boleh dipakai kunci di aplikasi INI. Kunci Qendali Event ditolak di sini. */
export const PRODUK_APLIKASI = 'qendali';

/**
 * Status yang ditampilkan ke frontend:
 * - `tanpa_lisensi` — tidak ada kunci; penegakan mati, semua terbuka (gagal-terbuka).
 * - `aktif`         — kunci sah dan masih berlaku.
 * - `tenggang`      — masa berlaku habis, masih di dalam `tenggangHari`. MASIH BOLEH MENULIS;
 *                     frontend cuma perlu memasang peringatan "segera perbarui".
 * - `hanya_baca`    — tenggang habis, atau kuncinya tidak sah. Menulis ditolak, membaca jalan.
 */
export type StatusLisensi = 'tanpa_lisensi' | 'aktif' | 'tenggang' | 'hanya_baca';

export interface Keadaan {
    /** false = gagal-terbuka: tidak ada kunci, jangan tegakkan apa pun. */
    ditegakkan: boolean;
    status: StatusLisensi;
    /** Menulis (POST/PUT/PATCH/DELETE) ditolak. Membaca/mencari/mencetak tetap jalan. */
    hanyaBaca: boolean;
    /** Alasan kunci ditolak, nama persis seperti penerbit. null kalau tidak ada masalah. */
    alasan: string | null;
    /** Jam mesin terdeteksi dimundurkan; yang dipakai `terakhirTerlihat`, bukan jam lokal. */
    jamMundur: boolean;
    klien: string | null;
    namaKlien: string | null;
    produk: string | null;
    paket: string | null;
    fitur: string[];
    batas: Record<string, number | null>;
    berlakuSampai: string | null;
    tenggangSampai: string | null;
    sisaHari: number | null;
    sisaHariTenggang: number | null;
    terakhirTerlihat: string | null;
}

export interface BahanKeadaan {
    /** Kunci `q1.…` yang tersimpan di instalasi ini. null/kosong = gagal-terbuka. */
    kunci?: string | null;
    kunciPublik: KunciPublik;
    /** Alamat instalasi untuk dicocokkan ke `alamatSah`. null = jangan periksa (offline). */
    alamat?: string | null;
    /** Stempel penyegaran terakhir yang berhasil — penangkal jam mesin yang dimundurkan. */
    terakhirTerlihat?: string | null;
    sekarang?: Date;
    /** Produk yang diharapkan; hanya diubah di tes. */
    produkAplikasi?: string;
}

const KOSONG: Omit<Keadaan, 'terakhirTerlihat'> = {
    ditegakkan: false,
    status: 'tanpa_lisensi',
    hanyaBaca: false,
    alasan: null,
    jamMundur: false,
    klien: null,
    namaKlien: null,
    produk: null,
    paket: null,
    fitur: [],
    batas: {},
    berlakuSampai: null,
    tenggangSampai: null,
    sisaHari: null,
    sisaHariTenggang: null,
};

const HARI = 24 * 60 * 60 * 1000;

const akhirTenggang = (isi: IsiKunci) =>
    new Date(new Date(isi.berlakuSampai).getTime() + (isi.tenggangHari ?? 0) * HARI).toISOString();

/** Isi dari kunci yang ditolak tetap dipakai untuk KETERANGAN (paket/klien), bukan untuk hak akses. */
function keterangan(isi: IsiKunci | undefined) {
    if (!isi) return {};
    return {
        klien: isi.klien ?? null,
        namaKlien: isi.namaKlien ?? null,
        produk: isi.produk ?? null,
        paket: isi.paket ?? null,
        berlakuSampai: isi.berlakuSampai ?? null,
        tenggangSampai: isi.berlakuSampai ? akhirTenggang(isi) : null,
    };
}

export function nilaiKeadaan({
    kunci,
    kunciPublik,
    alamat = null,
    terakhirTerlihat = null,
    sekarang = new Date(),
    produkAplikasi = PRODUK_APLIKASI,
}: BahanKeadaan): Keadaan {
    // ── Gagal-terbuka ────────────────────────────────────────────────────────────────
    // Tidak ada kunci = tidak ada yang bisa ditegakkan. Jangan pernah mengubah ini jadi
    // "tanpa kunci berarti tidak boleh apa-apa" (lihat kotak di atas berkas).
    if (!kunci || !String(kunci).trim()) {
        return { ...KOSONG, terakhirTerlihat };
    }

    const hasil = periksaKunci(String(kunci).trim(), {
        kunciPublik,
        alamat,
        sekarang,
        terakhirTerlihat,
    });

    if (!hasil.sah) {
        // Kunci ADA tapi tidak sah (diutak-atik, kid asing, salah alamat, …) → hanya-baca.
        // Bukan gagal-terbuka: kunci yang rusak adalah masalah yang harus kelihatan, dan
        // membacanya sebagai "tanpa lisensi" berarti merusak kunci = membuka semua fitur.
        return {
            ...KOSONG,
            ...keterangan(hasil.isi),
            ditegakkan: true,
            status: 'hanya_baca',
            hanyaBaca: true,
            alasan: hasil.alasan,
            terakhirTerlihat,
        };
    }

    // Kunci produk lain (mis. Qendali Event) wajib ditolak — isi fiturnya kosakata lain.
    if (hasil.isi.produk !== produkAplikasi) {
        return {
            ...KOSONG,
            ...keterangan(hasil.isi),
            ditegakkan: true,
            status: 'hanya_baca',
            hanyaBaca: true,
            alasan: 'produk_tidak_cocok',
            terakhirTerlihat,
        };
    }

    const masa = statusMasaBerlaku(hasil.isi, { sekarang, terakhirTerlihat });

    // CATATAN PENTING soal masa tenggang: acuan (`lib/lisensi.mjs`) menandai masa tenggang
    // sebagai hanyaBaca juga. Di aplikasi ini, tenggang MASIH BOLEH MENULIS — kalau tidak,
    // masa tenggang tidak ada gunanya: kasir yang hanya-baca sama saja dengan kasir mati,
    // dan tenggang justru ada supaya klien yang telat bayar beberapa hari tetap bisa jualan.
    // Hanya-baca baru menyala setelah tenggang habis.
    const status: StatusLisensi =
        masa.status === 'kedaluwarsa' ? 'hanya_baca' : masa.status === 'tenggang' ? 'tenggang' : 'aktif';

    return {
        ditegakkan: true,
        status,
        hanyaBaca: status === 'hanya_baca',
        alasan: status === 'hanya_baca' ? 'masa_berlaku_habis' : null,
        jamMundur: masa.jamMundur,
        klien: hasil.isi.klien,
        namaKlien: hasil.isi.namaKlien ?? null,
        produk: hasil.isi.produk,
        paket: hasil.isi.paket,
        fitur: [...(hasil.isi.fitur ?? [])],
        batas: { ...(hasil.isi.batas ?? {}) },
        berlakuSampai: hasil.isi.berlakuSampai,
        tenggangSampai: akhirTenggang(hasil.isi),
        sisaHari: masa.sisaHari,
        sisaHariTenggang: masa.sisaHariTenggang,
        terakhirTerlihat,
    };
}

/**
 * Boleh pakai fitur ini? Penegakan mati (tanpa kunci) = boleh semuanya.
 * Fitur TETAP boleh dipakai saat hanya-baca — yang diblokir cuma menulis, dan itu tugas
 * penjaga lain. Kalau fitur ikut mati, klien yang telat bayar tidak bisa mencetak ulang
 * nota lama, padahal justru itu yang dia butuhkan.
 */
export function bolehFitur(keadaan: Keadaan, kodeFitur: string): boolean {
    if (!keadaan.ditegakkan) return true;
    return punyaFitur({ fitur: keadaan.fitur } as IsiKunci, kodeFitur);
}

/**
 * Batas angka dari kunci, mis. `limit.users`, `limit.branches`. `null` = tanpa batas
 * (termasuk saat penegakan mati dan saat kodenya tidak ada di kunci).
 *
 * BELUM ADA YANG MENEGAKKAN BATAS INI. Fungsinya disediakan supaya penegakan berikutnya
 * (jumlah pengguna, jumlah cabang) tidak perlu menebak arti nilainya lagi — lihat
 * `docs/wiki/lisensi-qendali.md`.
 */
export function batasLisensi(keadaan: Keadaan, kodeBatas: string): number | null {
    if (!keadaan.ditegakkan) return null;
    return batasFitur({ batas: keadaan.batas } as IsiKunci, kodeBatas);
}
