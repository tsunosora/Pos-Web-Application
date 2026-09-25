/**
 * Verifikasi kunci lisensi Qendali — SALINAN LOGIKA dari penerbitnya, bukan tebakan.
 *
 * Acuan: `qendali/lib/lisensi.mjs` + `qendali/docs/lisensi.md` (repo website qendali.com).
 * Kalau acuan itu berubah, berkas ini yang harus ikut diubah — nama fungsi, nama alasan
 * penolakan, dan bentuk hasilnya sengaja dibuat sama supaya dua sisi bisa dibandingkan
 * baris demi baris.
 *
 * Tiga hal yang perlu diingat:
 * 1. Verifikasinya LOKAL, tanpa jaringan. Kita cuma pegang kunci publik; qendali.com yang
 *    pegang kunci privat. Jadi kasir tetap jalan walau internet atau server induk mati.
 * 2. Tanpa dependensi baru — Ed25519 sudah ada di `node:crypto` bawaan Node.
 * 3. Berkas ini MURNI (tanpa Nest, tanpa fs, tanpa env) supaya bisa diuji tanpa DB & jaringan.
 */
import { verify } from 'node:crypto';

/** Versi amplop. Ikut ditandatangani, jadi kunci lama tak bisa dipakai ulang di amplop baru. */
export const AMPLOP = 'q1';

/** Versi isi. Kunci dengan versi lain ditolak — versi baru berarti arti field-nya berubah. */
export const VERSI_ISI = 1;

const HARI = 24 * 60 * 60 * 1000;

const dariB64 = (teks: string) => Buffer.from(teks, 'base64url');

/** Isi kunci. Bentuknya ditentukan penerbit — lihat tabel di `docs/lisensi.md`. */
export interface IsiKunci {
    versi: number;
    kid: string;
    klien: string;
    namaKlien?: string;
    /** 'qendali' (POS) atau 'qendali_event'. Kunci produk lain WAJIB ditolak. */
    produk: string;
    paket: string;
    fitur: string[];
    batas: Record<string, number | null>;
    alamatSah: string[];
    terbitPada: string;
    berlakuSampai: string;
    tenggangHari?: number;
    catatan?: string;
}

/**
 * Alasan penolakan. Nama-namanya PERSIS seperti di penerbit — jangan diterjemahkan lagi,
 * supaya keluhan klien bisa dicocokkan ke log kedua sisi.
 */
export type AlasanTolak =
    | 'bentuk_kunci_salah'
    | 'amplop_tidak_dikenal'
    | 'isi_rusak'
    | 'versi_isi_tidak_didukung'
    | 'kid_tidak_dikenal'
    | 'tanda_tangan_rusak'
    | 'tanda_tangan_tidak_cocok'
    | 'alamat_tidak_sah';

export type HasilVerifikasi =
    | { sah: true; isi: IsiKunci }
    | { sah: false; alasan: AlasanTolak; isi?: IsiKunci };

/** Peta `kid` -> kunci publik PEM, supaya kunci penanda tangan bisa dirotasi tanpa ganti kode. */
export type KunciPublik = string | Record<string, string>;

/** Baca isi TANPA memverifikasi. Jangan dipakai untuk mengambil keputusan. */
export function bacaIsi(kunci: string): IsiKunci | null {
    const bagian = String(kunci).trim().split('.');
    if (bagian.length !== 3 || bagian[0] !== AMPLOP) return null;
    try {
        return JSON.parse(dariB64(bagian[1]).toString('utf8')) as IsiKunci;
    } catch {
        return null;
    }
}

/** Periksa tanda tangan saja. Masa berlaku & alamat diperiksa `periksaKunci()`. */
export function verifikasi(kunci: string, kunciPublik: KunciPublik): HasilVerifikasi {
    const bagian = String(kunci).trim().split('.');
    if (bagian.length !== 3) return { sah: false, alasan: 'bentuk_kunci_salah' };
    const [amplop, bagianIsi, bagianTtd] = bagian;
    if (amplop !== AMPLOP) return { sah: false, alasan: 'amplop_tidak_dikenal' };

    let isi: IsiKunci;
    try {
        isi = JSON.parse(dariB64(bagianIsi).toString('utf8')) as IsiKunci;
    } catch {
        return { sah: false, alasan: 'isi_rusak' };
    }
    if (isi?.versi !== VERSI_ISI) return { sah: false, alasan: 'versi_isi_tidak_didukung', isi };

    const pem = typeof kunciPublik === 'string' ? kunciPublik : kunciPublik?.[isi.kid];
    if (!pem) return { sah: false, alasan: 'kid_tidak_dikenal', isi };

    let cocok = false;
    try {
        cocok = verify(null, Buffer.from(`${AMPLOP}.${bagianIsi}`), pem, dariB64(bagianTtd));
    } catch {
        return { sah: false, alasan: 'tanda_tangan_rusak', isi };
    }
    if (!cocok) return { sah: false, alasan: 'tanda_tangan_tidak_cocok', isi };
    return { sah: true, isi };
}

export interface MasaBerlaku {
    /** 'aktif' | 'tenggang' | 'kedaluwarsa' — sama dengan penerbit. */
    status: 'aktif' | 'tenggang' | 'kedaluwarsa';
    /**
     * PERHATIAN: ikut acuan, `hanyaBaca` di sini menyala begitu masa berlaku habis —
     * termasuk selama masa tenggang. Yang dipakai guard aplikasi BUKAN field ini,
     * melainkan `Keadaan.hanyaBaca` di `keadaan-lisensi.ts`, yang baru menyala setelah
     * tenggang habis. Alasannya ada di berkas itu.
     */
    hanyaBaca: boolean;
    jamMundur: boolean;
    sisaHari: number;
    sisaHariTenggang: number;
}

/**
 * Masa berlaku. Habis masa BUKAN berarti mati — artinya aplikasi jadi hanya-baca:
 * membuat data baru ditolak, membaca/mencari/mencetak data lama tetap jalan.
 *
 * `terakhirTerlihat` = waktu penyegaran kunci terakhir yang DISIMPAN aplikasi. Jam mesin
 * klien tidak boleh dipercaya: di server Voliko sendiri jam pernah salah 10 jam. Kalau jam
 * lokal melompat mundur jauh dari terakhirTerlihat, jam LOKALNYA yang diabaikan — bukan
 * lisensinya. Tanpa itu, memundurkan jam server = lisensi abadi.
 */
export function statusMasaBerlaku(
    isi: IsiKunci,
    {
        sekarang = new Date(),
        terakhirTerlihat = null,
        toleransiJam = 2,
    }: {
        sekarang?: Date | number | string;
        terakhirTerlihat?: Date | string | null;
        toleransiJam?: number;
    } = {},
): MasaBerlaku {
    let waktu = new Date(sekarang);
    let jamMundur = false;

    if (terakhirTerlihat) {
        const batasMundur = new Date(new Date(terakhirTerlihat).getTime() - toleransiJam * 60 * 60 * 1000);
        if (waktu < batasMundur) {
            jamMundur = true;
            waktu = new Date(terakhirTerlihat);
        }
    }

    const berlakuSampai = new Date(isi.berlakuSampai);
    const akhirTenggang = new Date(berlakuSampai.getTime() + (isi.tenggangHari ?? 0) * HARI);

    let status: MasaBerlaku['status'] = 'aktif';
    if (waktu > akhirTenggang) status = 'kedaluwarsa';
    else if (waktu > berlakuSampai) status = 'tenggang';

    return {
        status,
        hanyaBaca: status !== 'aktif',
        jamMundur,
        sisaHari: Math.ceil((berlakuSampai.getTime() - waktu.getTime()) / HARI),
        sisaHariTenggang: Math.ceil((akhirTenggang.getTime() - waktu.getTime()) / HARI),
    };
}

/**
 * Alamat sah dicantumkan supaya satu kunci tidak bisa dipakai di banyak pemasangan.
 * Daftar kosong berarti tidak dibatasi (dipakai pemasangan desktop/offline).
 * Pola `*.cabang.qendali.com` cocok untuk induknya sendiri maupun subdomainnya.
 */
export function alamatCocok(isi: IsiKunci, alamat: string | null | undefined): boolean {
    const daftar = isi.alamatSah ?? [];
    if (daftar.length === 0) return true;
    if (!alamat) return false;
    const bersih = String(alamat)
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .split('/')[0]
        .split(':')[0];
    return daftar.some((a) => {
        const pola = String(a).toLowerCase();
        if (pola.startsWith('*.')) return bersih === pola.slice(2) || bersih.endsWith(pola.slice(1));
        return bersih === pola;
    });
}

export type HasilPeriksa =
    | ({ sah: true; isi: IsiKunci } & MasaBerlaku)
    | { sah: false; alasan: AlasanTolak; isi?: IsiKunci; status: 'tidak_sah'; hanyaBaca: true };

/**
 * Satu pintu: tanda tangan + masa berlaku + alamat sekaligus.
 * `alamat: null` = jangan periksa alamat (pemasangan offline / alamat belum diisi).
 */
export function periksaKunci(
    kunci: string,
    {
        kunciPublik,
        alamat = null,
        sekarang = new Date(),
        terakhirTerlihat = null,
    }: {
        kunciPublik: KunciPublik;
        alamat?: string | null;
        sekarang?: Date | number | string;
        terakhirTerlihat?: Date | string | null;
    },
): HasilPeriksa {
    const hasil = verifikasi(kunci, kunciPublik);
    if (!hasil.sah) return { ...hasil, status: 'tidak_sah', hanyaBaca: true };

    const masa = statusMasaBerlaku(hasil.isi, { sekarang, terakhirTerlihat });
    if (alamat !== null && !alamatCocok(hasil.isi, alamat)) {
        return { sah: false, alasan: 'alamat_tidak_sah', isi: hasil.isi, status: 'tidak_sah', hanyaBaca: true };
    }
    return { sah: true, isi: hasil.isi, ...masa };
}

/** Fitur dibaca per KODE, bukan per nama paket — add-on per klien tanpa ganti kode aplikasi. */
export function punyaFitur(isi: IsiKunci | null | undefined, kodeFitur: string): boolean {
    return Array.isArray(isi?.fitur) && isi.fitur.includes(kodeFitur);
}

/** Batas angka. `null` = tanpa batas — termasuk kode yang TIDAK ADA di kunci. */
export function batasFitur(isi: IsiKunci | null | undefined, kodeBatas: string): number | null {
    const nilai = isi?.batas?.[kodeBatas];
    return nilai === undefined ? null : nilai;
}
