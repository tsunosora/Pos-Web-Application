/**
 * Aturan "menu ikut isi kunci lisensi".
 *
 * Berkas ini MURNI: tanpa React, tanpa Next, tanpa axios, tanpa satu pun import. Itu disengaja
 * supaya aturannya bisa diuji dengan `node --test` (lihat `aturan-menu.test.mjs`) tanpa memasang
 * apa pun, dan supaya keputusan "menu ini tampil atau tidak" ada di SATU tempat yang bisa dibaca
 * sekali duduk — bukan tersebar di komponen.
 *
 * ┌─────────────────────────────────────────────────────────────────────────────────────┐
 * │ EMPAT ATURAN YANG TIDAK BOLEH DILANGGAR                                             │
 * │                                                                                     │
 * │ 1. Menyembunyikan menu itu KOSMETIK, bukan keamanan. Yang benar-benar menolak tetap  │
 * │    `FiturGuard` & `HanyaBacaGuard` di backend. Jangan pernah memindahkan keputusan   │
 * │    izin ke sini: siapa pun bisa mengubah JavaScript di browsernya sendiri.           │
 * │                                                                                     │
 * │ 2. GAGAL-TERBUKA, termasuk saat jaringan gagal. `/saya/fitur` gagal / lambat /       │
 * │    menjawab galat → SEMUA menu tampil seperti biasa. Begitu juga kalau lisensi tidak │
 * │    ditegakkan (`ditegakkan: false`). Kasir tidak boleh kehilangan menu gara-gara     │
 * │    satu permintaan gagal.                                                           │
 * │                                                                                     │
 * │ 3. Hanya sembunyikan menu yang kode fiturnya JELAS dan ada di peta di bawah. Menu    │
 * │    yang tidak ada di peta tetap tampil. Lebih baik menampilkan menu yang ternyata    │
 * │    ditolak backend daripada menyembunyikan menu yang sebenarnya boleh dipakai.       │
 * │                                                                                     │
 * │ 4. Jangan mematikan apa pun yang bersifat MEMBACA. Saat hanya-baca, laporan,         │
 * │    pencarian, dan cetak ulang tetap harus bisa dibuka — jadi `hanyaBaca` TIDAK       │
 * │    pernah dipakai untuk menyembunyikan menu. Yang menyembunyikan menu cuma "kode     │
 * │    fiturnya tidak ada di kunci".                                                     │
 * └─────────────────────────────────────────────────────────────────────────────────────┘
 *
 * Kosakata kode fiturnya milik `data/paket.json` di repo qendali.com. Tulis kodenya apa adanya —
 * nama yang dikarang di sini tidak akan pernah cocok dengan kunci yang terbit.
 */

export type StatusLisensi = 'tanpa_lisensi' | 'aktif' | 'tenggang' | 'hanya_baca';

/**
 * Cerminan jawaban `GET /saya/fitur` (lihat `backend/src/lisensi/lisensi.controller.ts`).
 * Instalasi tanpa kunci menjawab bentuk yang sama dengan isi kosong.
 */
export interface KeadaanLisensi {
    /** false = penegakan mati (tanpa kunci). Semua fitur dianggap ada. */
    ditegakkan: boolean;
    status: StatusLisensi;
    /** Menulis ditolak backend. TIDAK boleh dipakai untuk menyembunyikan menu (aturan 4). */
    hanyaBaca: boolean;
    alasan: string | null;
    produk: string | null;
    paket: string | null;
    klien: string | null;
    namaKlien: string | null;
    fitur: string[];
    batas: Record<string, number | null>;
    /**
     * Jumlah yang TERPAKAI sekarang untuk batas yang ditegakkan backend, mis.
     * `{ "limit.users": 4 }`. Bentuknya sengaja kembar dengan `batas` supaya keduanya gampang
     * dipasangkan. Kode yang tidak ada di sini berarti belum/tidak dihitung — jangan dibaca
     * sebagai nol. Yang memakainya: `pemakaian-batas.ts`.
     */
    pemakaian?: Record<string, number>;
    berlakuSampai: string | null;
    tenggangSampai: string | null;
    sisaHari: number | null;
    sisaHariTenggang: number | null;
    jamMundur?: boolean;
    terakhirTerlihat?: string | null;
}

export type PunyaFitur = (kode: string) => boolean;

/**
 * Menu (href) → kode fitur yang harus ada di kunci supaya menunya tampil.
 *
 * Yang TIDAK ada di tabel ini SELALU tampil. Beberapa dibiarkan tampil dengan sengaja:
 *
 * | Menu | Kenapa dibiarkan tampil |
 * |---|---|
 * | `/`, `/beranda` | Pintu masuk. Menyembunyikannya = staf melihat menu kosong. |
 * | `/pos` | `pos.core` ada di SEMUA paket, jadi tidak ada yang bisa disembunyikan — sementara risiko salah sembunyi = kasir tidak bisa jualan. Tidak sebanding. |
 * | `/reports/sales` | Rekap penjualan itu bacaan dasar dari transaksi `pos.core`. |
 * | `/transactions/edit-requests` | Pengawasan koreksi transaksi; tidak ada kode fiturnya. |
 * | `/maps` | Peta Cuan Lokasi tidak ada di kosakata `paket.json`. |
 * | `/owner` | Dasbor Owner isinya campur (cashflow, KPI, bonus, rating CS, setelan Studio AI). Satu kode untuk seluruh halaman justru salah — yang berkode `owner.finance` cuma `/owner/analisa-keuangan` di dalamnya. |
 * | `/settings/whatsapp` | Itu bot WhatsApp tempel-QR, BUKAN Cloud API. `wa.cloud` salah alamat, dan bot itu tidak dijual di paket mana pun. |
 * | `/settings/printer` | Setelan struk 58 mm = bagian kasir. `printer.relay` cuma soal relay printer lokal. |
 * | `/settings/branches`, `/settings/branch-config` | Klien satu outlet pun punya satu baris cabang yang namanya & alamatnya muncul di struk. Harus tetap bisa disunting. |
 * | `/settings/langganan` | Jalan keluar dari hanya-baca. Tidak boleh pernah hilang. |
 */
export const PETA_FITUR_MENU: Readonly<Record<string, string>> = {
    // ── Penjualan & Keuangan ──────────────────────────────────────────────────────────
    '/reports/profit': 'reports.profit',
    '/reports/tutup-buku': 'books.monthly',
    '/reports/shift-history': 'shift.close',
    '/transactions/dp': 'ar.dp',
    '/cashflow': 'finance.cashflow',

    // ── Inventori & Stok ──────────────────────────────────────────────────────────────
    '/inventory': 'inventory.stock',
    '/reports/stock': 'inventory.stock',
    // Data supplier cuma ada gunanya kalau stok dicatat — satu paket dengan inventori.
    '/inventory/suppliers': 'inventory.stock',
    '/inventory/opname': 'inventory.opname',
    // Laporan bahan titipan = pemakaian bahan antar cabang → ikut buku titipan.
    '/reports/inter-branch-usage': 'branch.ledger',
    '/inventory/transfer': 'branch.ops',

    // ── Produksi & Cetak ──────────────────────────────────────────────────────────────
    '/titipan-masuk': 'branch.ledger',
    '/titipan-keluar': 'branch.ledger',
    '/branch-ledger': 'branch.ledger',
    '/produksi': 'production.board',
    '/produksi/pipeline': 'production.pipeline',
    '/print-queue': 'print.queue',
    '/click-counting': 'click.counting',

    // ── Pelanggan & Order ─────────────────────────────────────────────────────────────
    '/crm': 'crm.leads',
    '/crm/leads': 'crm.leads',
    '/crm/follow-ups': 'crm.leads',
    '/crm/templates': 'crm.leads',
    '/customers': 'customers.core',
    '/invoices': 'invoice.quotation',
    // `so.designer` = "Portal desainer & sales order" — satu alur, satu kode.
    '/sales-orders': 'so.designer',
    '/branch-orders': 'branch.ops',

    // ── WhatsApp CRM (add-on, bukan isi paket) ────────────────────────────────────────
    '/crm/whatsapp': 'wa.cloud',
    '/crm/whatsapp/qr': 'wa.cloud',
    '/crm/whatsapp/quick-replies': 'wa.cloud',
    '/crm/whatsapp/templates': 'wa.cloud',
    '/crm/whatsapp/catalog': 'wa.cloud',
    '/crm/whatsapp/analytics': 'wa.cloud',
    '/crm/whatsapp/settings': 'wa.cloud',
    '/crm/whatsapp/broadcast': 'wa.automation',
    '/crm/whatsapp/auto-reply': 'wa.automation',
    '/crm/whatsapp/reminders': 'wa.automation',
    '/crm/social': 'social.inbox',
    '/owner/iklan': 'ads.meta',

    // ── Landing Page ──────────────────────────────────────────────────────────────────
    '/landing-page': 'site.landing',
    '/articles': 'site.landing',

    // ── Analisa & Kalkulator ──────────────────────────────────────────────────────────
    '/reports/hpp': 'hpp.calc',
    '/owner/hpp-produk': 'hpp.calc',

    // ── Tim & Kinerja ─────────────────────────────────────────────────────────────────
    '/leaderboard': 'team.leaderboard',
    '/tugas': 'tasks.piket',
    '/tugas/papan-piket': 'tasks.piket',
    '/tugas/pantau': 'tasks.piket',
    '/tugas/grup': 'tasks.piket',
    '/tugas/jadwal': 'tasks.piket',

    // ── Tautan mandiri ────────────────────────────────────────────────────────────────
    '/desainer': 'ai.studio',

    // ── Pengaturan ────────────────────────────────────────────────────────────────────
    '/settings/akses-menu': 'rbac.menu',
    '/settings/discord': 'notify.discord',
    '/settings/backup': 'backup.cloud',
};

/** Kode fitur untuk sebuah href, atau null kalau menunya sengaja tidak dipetakan. */
export function kodeFiturMenu(href: string): string | null {
    return PETA_FITUR_MENU[href] ?? null;
}

/**
 * Membuat penjawab "boleh pakai fitur ini?" dari jawaban `/saya/fitur`.
 *
 * GAGAL-TERBUKA di tiga keadaan, dan ketiganya penting:
 * - `keadaan` null/undefined — belum termuat, atau permintaannya gagal. Jangan menunggu.
 * - `ditegakkan: false` — instalasi tanpa kunci (Voliko, semua lingkungan pengembangan).
 * - `fitur` kosong — kunci ADA tapi ditolak (tanda tangan rusak, alamat salah, produk lain).
 *   Tidak ada paket Qendali yang isinya nol fitur, jadi daftar kosong selalu berarti "tidak
 *   tahu", bukan "tidak boleh apa-apa". Kalau ini ditutup, satu kunci rusak membuat seluruh
 *   menu lenyap sekaligus — padahal saat itu klien justru perlu membuka laporan lamanya.
 */
export function buatPunyaFitur(keadaan: KeadaanLisensi | null | undefined): PunyaFitur {
    if (!keadaan || !keadaan.ditegakkan) return () => true;
    const daftar = Array.isArray(keadaan.fitur)
        ? keadaan.fitur.filter((k): k is string => typeof k === 'string' && k.length > 0)
        : [];
    if (daftar.length === 0) return () => true;
    const punya = new Set(daftar);
    return (kode: string) => punya.has(kode);
}

/**
 * Menu ini tampil? Tanpa `punyaFitur` → tampil (gagal-terbuka lagi, kali ini untuk pemanggil
 * yang belum sempat mengoper apa pun).
 */
export function bolehLihatMenu(href: string, punyaFitur?: PunyaFitur | null): boolean {
    const kode = kodeFiturMenu(href);
    if (!kode) return true;
    if (typeof punyaFitur !== 'function') return true;
    return punyaFitur(kode);
}

// ── Spanduk keadaan lisensi ────────────────────────────────────────────────────────────

export interface Spanduk {
    /** `peringatan` = kuning, masih boleh mencatat. `genting` = merah, menulis ditolak. */
    nada: 'peringatan' | 'genting';
    judul: string;
    pesan: string;
    /** Peringatan tenggang boleh ditutup pemakai; hanya-baca tidak — itu bukan kabar sepele. */
    bisaDitutup: boolean;
}

/**
 * Spanduk apa yang perlu dipasang, atau null kalau tidak perlu apa-apa.
 *
 * TIDAK ADA SPANDUK saat `tanpa_lisensi` / `ditegakkan: false`. Instalasi yang belum tersambung
 * ke qendali.com itu keadaan NORMAL — Voliko dan semua lingkungan pengembangan ada di situ.
 * Menaruh spanduk di sana cuma melatih orang mengabaikan spanduk.
 */
export function spandukLisensi(keadaan: KeadaanLisensi | null | undefined): Spanduk | null {
    if (!keadaan || !keadaan.ditegakkan) return null;

    if (keadaan.status === 'tenggang') {
        const n = keadaan.sisaHariTenggang;
        const sisa = typeof n === 'number' && n >= 0 ? `${n} hari` : 'beberapa hari';
        return {
            nada: 'peringatan',
            judul: 'Kunci lisensi belum tersegarkan',
            // Sengaja menyebut "masih bisa dicatat seperti biasa": masa tenggang memang belum
            // mematikan apa pun, dan menakut-nakuti kasir di jam sibuk tidak ada gunanya.
            pesan: `Sisa ${sisa} sebelum aplikasi jadi hanya-baca. Sampai itu semua transaksi masih bisa dicatat seperti biasa.`,
            bisaDitutup: true,
        };
    }

    if (keadaan.status === 'hanya_baca') {
        return {
            nada: 'genting',
            judul: 'Aplikasi sedang hanya-baca',
            pesan: 'Data lama tetap bisa dibuka, dicari, dan dicetak ulang. Transaksi baru belum bisa dicatat sampai lisensinya diperbarui.',
            bisaDitutup: false,
        };
    }

    return null;
}
