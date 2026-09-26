/**
 * Aturan batas angka lisensi (`limit.users`, `limit.branches`) — MURNI, tanpa import, tanpa DB.
 * Yang menghitung pemakaian & melempar galat ada di `batas.service.ts`; di sini cuma keputusan
 * "boleh nambah atau tidak" plus kalimat yang dibaca pemakai.
 *
 * ┌─────────────────────────────────────────────────────────────────────────────────────┐
 * │ KEPUTUSAN PEMILIK — jangan diubah tanpa dia yang minta                              │
 * │                                                                                     │
 * │ 1. KLIEN YANG SUDAH LEWAT BATAS DIBIARKAN. Tidak ada pengguna dinonaktifkan, tidak   │
 * │    ada cabang dimatikan, tidak ada data disembunyikan. Yang ditolak HANYA penambahan │
 * │    baru selama jumlahnya masih ≥ batas. Toko dengan 8 pengguna di paket berbatas 5:   │
 * │    delapan-delapannya tetap masuk kerja besok pagi; yang kesembilan ditolak.         │
 * │    Alasannya: batas ini baru dipasang di tengah jalan. Kunci pertama yang terbit      │
 * │    untuk klien yang sudah setahun memakai aplikasi tidak boleh mengunci karyawannya   │
 * │    di luar pintu gara-gara angka di paket — itu memutus jualan, bukan menagih.        │
 * │                                                                                     │
 * │ 2. GAGAL-TERBUKA. Batas `null` = TANPA BATAS. Kode batas yang tidak ada di kunci juga │
 * │    dibaca `null` (lihat `batasFitur()` di `periksa-kunci.ts`) — itu memang disengaja. │
 * │    Penegakan mati (tanpa kunci) juga berarti tanpa batas.                            │
 * │                                                                                     │
 * │ 3. NOL ≠ TANPA BATAS. `0` berarti jenis ini memang TIDAK termasuk paket, jadi tidak   │
 * │    boleh menambah satu pun. Bedakan dari `null` dengan hati-hati: `if (!batas)` salah │
 * │    di sini, `if (batas === null)` yang benar.                                        │
 * │                                                                                     │
 * │ 4. YANG DITEGAKKAN CUMA DUA: `limit.users` & `limit.branches`.                       │
 * │    - `limit.customers` SENGAJA TIDAK. Pelanggan sering dibuat di tengah transaksi;    │
 * │      menolaknya berarti menghentikan penjualan di depan pembeli yang sedang menunggu. │
 * │    - `limit.retention` SENGAJA TIDAK. Itu soal sejauh apa laporan boleh menengok ke   │
 * │      belakang — penyaringan, bukan penolakan, dan butuh pemikiran produk sendiri.     │
 * │    - `limit.wa_percakapan` JANGAN PERNAH. Meta menagih per pesan langsung ke akun     │
 * │      klien, jadi tidak ada kuota yang perlu dijaga aplikasi.                          │
 * └─────────────────────────────────────────────────────────────────────────────────────┘
 */

/** Satu jenis batas yang ditegakkan, lengkap dengan kata-kata untuk layar & pesan galat. */
export interface JenisBatas {
    /** Kode persis seperti di `data/paket.json` repo qendali. Jangan karang nama baru. */
    kode: string;
    /** Label di layar, huruf besar di depan: "Pengguna", "Cabang". */
    nama: string;
    /** Bentuk yang enak disambung di tengah kalimat: "5 pengguna", "3 cabang". */
    satuan: string;
    /** Jalan keluar yang TIDAK menuntut naik paket — ditawarkan di pesan galat. */
    saran: string;
}

/**
 * Daftar batas yang benar-benar ditegakkan. Menambah baris di sini belum cukup: `batas.service.ts`
 * juga harus tahu cara menghitung pemakaiannya, dan tempat penambahannya harus memanggil
 * pemeriksa. Kode yang tidak ada di daftar ini tidak pernah menolak apa pun.
 */
export const BATAS_DITEGAKKAN: readonly JenisBatas[] = [
    {
        kode: 'limit.users',
        nama: 'Pengguna',
        satuan: 'pengguna',
        saran: 'tandai pengguna lain keluar dulu',
    },
    {
        kode: 'limit.branches',
        nama: 'Cabang',
        satuan: 'cabang',
        saran: 'nonaktifkan cabang lain dulu',
    },
];

export const KODE_BATAS_DITEGAKKAN: readonly string[] = BATAS_DITEGAKKAN.map((j) => j.kode);

export const jenisBatas = (kode: string): JenisBatas | undefined =>
    BATAS_DITEGAKKAN.find((j) => j.kode === kode);

/**
 * Nama paket untuk dibaca manusia, dari kode di kunci (`usaha` → `Usaha`,
 * `vendor_event` → `Vendor Event`). Aplikasi ini tidak membawa `data/paket.json`, jadi nama
 * tampilannya diturunkan dari kodenya — bukan disalin, supaya tidak pernah basi.
 */
export function namaPaket(kode: string | null | undefined): string {
    const bersih = String(kode ?? '').trim();
    if (!bersih) return 'yang terpasang'; // "Paket yang terpasang membatasi …"
    return bersih
        .split(/[_-]+/)
        .filter(Boolean)
        .map((k) => k.charAt(0).toUpperCase() + k.slice(1))
        .join(' ');
}

export interface PutusanBatas {
    kode: string;
    /** null = tanpa batas (tidak ditegakkan, atau kodenya tidak ada di kunci). */
    batas: number | null;
    pemakaian: number;
    /** Sisa slot; null kalau tanpa batas. Negatif = klien lama yang sudah lewat batas. */
    sisa: number | null;
    /** Boleh menambah satu lagi? */
    boleh: boolean;
    /** Sudah menyentuh atau melewati batas. */
    penuh: boolean;
    /** Sudah DI ATAS batas — klien lama yang dibiarkan (keputusan 1). */
    lewat: boolean;
    /** Batasnya nol: jenis ini tidak termasuk paket (keputusan 3). */
    nol: boolean;
    /** Kalimat untuk pemakai. null kalau boleh. */
    pesan: string | null;
}

export interface BahanPutusan {
    kode: string;
    batas: number | null;
    pemakaian: number;
    /** Kode paket dari kunci, mis. `usaha`. Cuma untuk kalimatnya. */
    paket?: string | null;
}

/**
 * Boleh menambah satu lagi?
 *
 * Pesannya ditulis untuk MENOLONG, bukan menghakimi: sebut jumlah sekarang, batasnya, nama
 * paketnya, dan dua jalan keluar (naik paket, atau nonaktifkan yang lain). Yang sudah lewat
 * batas juga diberi tahu terang-terangan bahwa data lamanya tidak diapa-apakan — kalimat yang
 * ambigu di sini membuat orang panik mengira karyawannya baru saja dihapus.
 */
export function putusanBatas({ kode, batas, pemakaian, paket = null }: BahanPutusan): PutusanBatas {
    const jenis = jenisBatas(kode);
    const satuan = jenis?.satuan ?? kode;
    const saran = jenis?.saran ?? 'kurangi yang sudah ada dulu';
    const jumlah = Number.isFinite(pemakaian) && pemakaian > 0 ? Math.trunc(pemakaian) : 0;

    // `null` = tanpa batas. JANGAN ditulis `!batas` — 0 punya arti sendiri (keputusan 3).
    if (batas === null || batas === undefined) {
        return {
            kode,
            batas: null,
            pemakaian: jumlah,
            sisa: null,
            boleh: true,
            penuh: false,
            lewat: false,
            nol: false,
            pesan: null,
        };
    }

    const sisa = batas - jumlah;
    const boleh = jumlah < batas;
    const dasar = { kode, batas, pemakaian: jumlah, sisa, boleh, nol: batas === 0 };

    if (boleh) return { ...dasar, penuh: false, lewat: false, pesan: null };

    const kemana = 'Naikkan paket di Pengaturan → Langganan';

    if (batas === 0) {
        return {
            ...dasar,
            penuh: true,
            lewat: jumlah > 0,
            pesan:
                `Paket ${namaPaket(paket)} tidak memasukkan ${satuan} sama sekali (batasnya 0), ` +
                `jadi menambah ${satuan} baru belum bisa. ${kemana} kalau memang butuh.`,
        };
    }

    if (jumlah > batas) {
        return {
            ...dasar,
            penuh: true,
            lewat: true,
            pesan:
                `Paket ${namaPaket(paket)} membatasi ${batas} ${satuan}, dan sekarang sudah ada ${jumlah}. ` +
                `Yang ${jumlah} itu tetap jalan seperti biasa — yang belum bisa cuma menambah yang baru. ` +
                `${kemana}, atau ${saran}.`,
        };
    }

    return {
        ...dasar,
        penuh: true,
        lewat: false,
        pesan:
            `Paket ${namaPaket(paket)} membatasi ${batas} ${satuan}, dan sekarang sudah ada ${jumlah}. ` +
            `${kemana}, atau ${saran}.`,
    };
}
