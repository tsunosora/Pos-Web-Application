/**
 * ATURAN untuk pekerjaan yang jalan SENDIRI di dalam proses (cron/penjadwal & alur webhook).
 *
 * `FiturGuard` itu penjaga HTTP: dia cuma melihat permintaan yang masuk lewat controller. Cron
 * tidak lewat controller, jadi klien yang kode fiturnya dicabut tetap mengirim broadcast &
 * reminder yang sudah terjadwal sebelum paketnya turun — dan tiap pesan itu ditagih Meta ke
 * kartu kliennya. Berkas ini menutup celah itu, di SATU tempat, supaya enam penjadwal tidak
 * punya enam gaya `if` yang berbeda.
 *
 * Murni: tanpa Nest, tanpa DB, tanpa jaringan, tanpa log. Yang menyuntik & mencatat
 * `penjaga-terjadwal.service.ts`.
 *
 * ┌─────────────────────────────────────────────────────────────────────────────────────┐
 * │ EMPAT ATURAN YANG TIDAK BOLEH DILANGGAR                                             │
 * │                                                                                     │
 * │ 1. GAGAL-TERBUKA. Tanpa kunci / penegakan mati → jalan seperti biasa. Kunci rusak    │
 * │    juga tidak boleh mematikan penjadwal gara-gara "fiturnya tidak terbaca" (lihat    │
 * │    urutan putusan di bawah: hanya-baca diperiksa DULU, jadi kunci rusak dilaporkan   │
 * │    sebagai hanya-baca, bukan sebagai fitur yang hilang).                             │
 * │ 2. JANGAN MERUSAK ANTREAN. Pekerjaan yang dilewati tidak ditandai gagal, tidak       │
 * │    dihapus, dan penghitung percobaannya tidak dinaikkan. Karena itu pemeriksaannya   │
 * │    dipasang SEBELUM baris apa pun diklaim/ditulis — lihat `dipasangDi` tiap          │
 * │    pekerjaan. Begitu paketnya dipulihkan, sapuan berikutnya melanjutkan sendiri.     │
 * │ 3. JANGAN MEMBANJIRI LOG. Penjadwal broadcast jalan TIAP MENIT. Satu baris per       │
 * │    putaran = 1.440 baris sehari untuk satu klien yang paketnya turun. Karena itu     │
 * │    pencatatannya per PERUBAHAN keadaan, bukan per putaran (`penjaga-terjadwal`).     │
 * │ 4. PENJADWAL TIDAK BOLEH MATI gara-gara pemeriksaan ini. Semua `throw` dibungkus di  │
 * │    service, dan hasilnya "jalan seperti biasa".                                      │
 * └─────────────────────────────────────────────────────────────────────────────────────┘
 */
import { Keadaan, bolehFitur } from './keadaan-lisensi';

/**
 * Kode pekerjaan terjadwal. Bukan kode fitur lisensi — ini nama internal supaya call site-nya
 * bisa dibaca sekali lihat dan supaya `grep` dari sini langsung ketemu tempat pemasangannya.
 */
export type KodePekerjaan =
    | 'wa.broadcast'
    | 'wa.reminder'
    | 'wa.balasan-otomatis'
    | 'wa.sinkron-template'
    | 'sosial.komentar'
    | 'crm.repeat-order';

export interface AturanPekerjaan {
    /** Nama yang muncul di log, ditulis untuk dibaca orang. */
    nama: string;
    /**
     * SEMUA kode ini wajib ada di kunci — sama artinya dengan `@ButuhFitur`, sengaja, supaya
     * cron dan endpoint-nya tidak pernah punya jawaban berbeda untuk fitur yang sama.
     */
    fitur: readonly string[];
    /**
     * Ikut berhenti saat lisensi HANYA-BACA (kedaluwarsa melewati tenggang)?
     *
     * `true` untuk yang MENGIRIM atau MEMBUAT data usaha baru: itu menimbulkan biaya Meta ke
     * kartu klien dan menambah data di instalasi yang statusnya sudah "cuma boleh dibaca".
     * `false` untuk yang cuma MENARIK keadaan dari Meta (sinkron template, sinkron komentar):
     * memblokirnya berarti pesan & komentar pelanggan hilang, alasan yang sama dengan kenapa
     * webhook Meta sengaja dibiarkan terbuka di `hanya-baca.guard.ts`.
     *
     * Catat: masa TENGGANG tetap jalan penuh. Cuma kedaluwarsa yang berhenti.
     */
    berhentiSaatHanyaBaca: boolean;
    /** Berkas & fungsi tempat pemeriksaannya dipasang — dipakai tes & wiki, bukan hiasan. */
    dipasangDi: string;
}

/**
 * Enam pekerjaan yang berjalan sendiri di dalam proses.
 *
 * Yang SENGAJA tidak ada di sini, dan alasannya:
 * - **Bersih-bersih media WA (03.00, `media-storage.service.ts`)** — cuma menghapus berkas media
 *   lama di disk sendiri. Tidak mengirim apa pun, tidak menyentuh Meta, tidak menagih klien
 *   sepeser pun. Menjaganya justru merugikan klien: disk penuh sementara dia sudah bayar lagi.
 *   Tidak ada kode fitur yang cocok untuk "tukang sapu".
 * - **Penyegaran lisensi harian (`lisensi.service.ts`)** — satu-satunya jalan KELUAR dari
 *   keadaan terkunci. Menjaganya dengan lisensi itu memasang kunci di dalam kamar.
 * - **Papan tugas & piket, champion Discord, sinkron desktop** — belum dijaga di lapis HTTP
 *   juga. Menutup cron-nya lebih dulu berarti cron dan endpoint-nya menjawab beda.
 */
export const PEKERJAAN_TERJADWAL: Readonly<Record<KodePekerjaan, AturanPekerjaan>> = {
    // Tiap menit. Broadcast SCHEDULED yang sudah waktunya → dijalankan.
    'wa.broadcast': {
        nama: 'broadcast WhatsApp terjadwal',
        // Sama dengan `@ButuhFitur('wa.cloud', 'wa.automation')` di `/whatsapp/broadcasts*`:
        // siaran butuh channel-nya (wa.cloud) DAN otomasinya (wa.automation).
        fitur: ['wa.cloud', 'wa.automation'],
        berhentiSaatHanyaBaca: true,
        dipasangDi: 'whatsapp-cloud/broadcast.service.ts → sweepScheduled()',
    },
    // Tiap 15 menit. Reminder template untuk follow-up yang jatuh tempo.
    'wa.reminder': {
        nama: 'pengingat follow-up WhatsApp',
        fitur: ['wa.cloud', 'wa.automation'],
        berhentiSaatHanyaBaca: true,
        dipasangDi: 'whatsapp-cloud/reminders.service.ts → sweepFollowUps()',
    },
    // Bukan cron: dipicu pesan masuk dari webhook. Tetap di sini karena celahnya sama —
    // webhook sengaja dibiarkan terbuka, jadi balasannya terkirim tanpa lewat FiturGuard.
    'wa.balasan-otomatis': {
        nama: 'balasan otomatis WhatsApp',
        fitur: ['wa.cloud', 'wa.automation'],
        berhentiSaatHanyaBaca: true,
        dipasangDi: 'whatsapp-cloud/auto-reply.service.ts → handleInbound()',
    },
    // Tiap 10 menit. Menarik status template dari Graph API (jaring pengaman kalau webhook mati).
    'wa.sinkron-template': {
        nama: 'sinkron status template Meta',
        // Cuma `wa.cloud`: ini menyentuh Cloud API, tapi tidak mengirim pesan ke siapa pun,
        // jadi klien yang punya channel tanpa otomasi tetap butuh status templatenya benar.
        fitur: ['wa.cloud'],
        berhentiSaatHanyaBaca: false,
        dipasangDi: 'whatsapp-cloud/templates.service.ts → autoSyncStatuses()',
    },
    // Tiap 5 menit. Menarik komentar & DM IG/FB (cadangan webhook).
    'sosial.komentar': {
        nama: 'sinkron komentar & DM Instagram/Facebook',
        fitur: ['social.inbox'],
        berhentiSaatHanyaBaca: false,
        dipasangDi: 'meta-messaging/social-comments.service.ts → autoSync()',
    },
    // Senin 08.00 WIB, dan itu pun mati kecuali CRM_REPEAT_ORDER_AUTO=on.
    'crm.repeat-order': {
        nama: 'follow-up repeat order mingguan',
        fitur: ['crm.leads'],
        // Membuat baris FollowUp baru = data usaha baru, dan FU itu ikut dihitung di KPI CS.
        berhentiSaatHanyaBaca: true,
        dipasangDi: 'crm/follow-ups/follow-ups.cron.ts → scheduleRepeatOrders()',
    },
};

export type AlasanLewat = 'hanya_baca' | 'fitur_tidak_ada';

export interface PutusanTerjadwal {
    boleh: boolean;
    alasan: AlasanLewat | null;
    /** Kode fitur yang tidak ada di kunci. Kosong kalau alasannya bukan soal fitur. */
    fiturKurang: string[];
    paket: string | null;
    /** Kalimat siap-log, satu baris, tanpa titik di akhir. null kalau boleh jalan. */
    catatan: string | null;
}

const BOLEH: PutusanTerjadwal = { boleh: true, alasan: null, fiturKurang: [], paket: null, catatan: null };

/**
 * Boleh jalan atau tidak. URUTANNYA penting:
 *
 * 1. Penegakan mati → boleh. Tidak ada yang perlu diperiksa lagi.
 * 2. Hanya-baca (untuk pekerjaan yang ikut berhenti) → dilewati. Diperiksa SEBELUM fitur,
 *    karena kunci yang tidak sah membuat `fitur` kosong: kalau fitur diperiksa dulu, klien yang
 *    kuncinya kedaluwarsa akan dilaporkan "fitur wa.cloud dicabut" — salah, dan menyesatkan
 *    orang yang membaca log ke dasbor yang tidak salah apa-apa.
 * 3. Fitur kurang → dilewati.
 */
export function putusanTerjadwal(keadaan: Keadaan, kode: KodePekerjaan): PutusanTerjadwal {
    const aturan = PEKERJAAN_TERJADWAL[kode];
    // Kode yang tidak dikenal = salah tulis programmer. Jangan menebak, dan jangan pula
    // menghentikan penjadwal gara-gara itu — gagal-terbuka, biar ketahuan lewat tes.
    if (!aturan) return BOLEH;
    if (!keadaan.ditegakkan) return BOLEH;

    if (aturan.berhentiSaatHanyaBaca && keadaan.hanyaBaca) {
        return {
            boleh: false,
            alasan: 'hanya_baca',
            fiturKurang: [],
            paket: keadaan.paket,
            catatan:
                `${aturan.nama} dilewati: lisensi HANYA-BACA (${keadaan.alasan ?? 'masa berlaku habis'}). ` +
                'Pekerjaannya tidak dibatalkan — dilanjutkan sendiri setelah lisensi diperbarui',
        };
    }

    const kurang = aturan.fitur.filter((f) => !bolehFitur(keadaan, f));
    if (kurang.length === 0) return BOLEH;

    return {
        boleh: false,
        alasan: 'fitur_tidak_ada',
        fiturKurang: kurang,
        paket: keadaan.paket,
        catatan:
            `${aturan.nama} dilewati: kode fitur ${kurang.join(', ')} tidak ada di paket ` +
            `${keadaan.paket ?? 'yang terpasang'}. Pekerjaannya tidak dibatalkan — dilanjutkan ` +
            'sendiri begitu fiturnya dipasang lagi di qendali.com',
    };
}
