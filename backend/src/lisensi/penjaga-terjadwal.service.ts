/**
 * SATU pemeriksa lisensi untuk semua pekerjaan yang jalan sendiri di dalam proses.
 *
 * Dipakai begini — satu baris, di paling atas, sebelum baris apa pun diklaim:
 *
 *     @Cron('0 * * * * *')
 *     async sweepScheduled() {
 *         if (lewatiKarenaLisensi(this.penjagaTerjadwal, 'wa.broadcast')) return;
 *         …
 *     }
 *
 * Aturannya di `aturan-terjadwal.ts` (murni, bisa diuji sampai pojok). Di sini cuma dua hal:
 * MENCATAT dengan hemat, dan TIDAK PERNAH MELEMPAR.
 *
 * ┌─────────────────────────────────────────────────────────────────────────────────────┐
 * │ `bolehJalan()` TIDAK PERNAH MELEMPAR, dan kalau ragu jawabannya `true`.              │
 * │                                                                                     │
 * │ Penjadwal yang mati karena pemeriksaan lisensinya sendiri meledak adalah kerusakan   │
 * │ yang jauh lebih mahal daripada beberapa pesan yang kelewat terkirim: broadcast yang  │
 * │ tidak pernah jalan tidak meninggalkan jejak galat di mana pun — pemiliknya baru tahu │
 * │ berhari-hari kemudian, dari pelanggan yang tidak pernah dihubungi.                   │
 * └─────────────────────────────────────────────────────────────────────────────────────┘
 *
 * Kenapa call site-nya memakai `lewatiKarenaLisensi()` dan bukan langsung memanggil metodenya:
 * parameter penjaganya `@Optional()`, dan `if (!this.penjaga?.bolehJalan(…)) return;` justru
 * GAGAL-TERTUTUP — penjaga yang tidak tersuntik membuat `?.` bernilai `undefined`, `!undefined`
 * bernilai true, dan penjadwalnya berhenti total tanpa satu baris log. Jebakan satu karakter
 * yang arah kegagalannya persis kebalikan dari yang dimaui. Fungsi di bawah menutupnya sekali.
 */
import { Injectable, Logger } from '@nestjs/common';
import { KodePekerjaan, PEKERJAAN_TERJADWAL, PutusanTerjadwal, putusanTerjadwal } from './aturan-terjadwal';
import { LisensiService } from './lisensi.service';

interface Catatan {
    /** Alasan + daftar fitur, dipakai untuk tahu apakah keadaannya BERUBAH. */
    kunciAlasan: string;
    /** Kapan terakhir dicatat ke log. */
    pada: number;
}

@Injectable()
export class PenjagaTerjadwal {
    private readonly log = new Logger('Lisensi');

    /** Keadaan terakhir yang sudah dicatat, per pekerjaan. Cuma untuk menahan banjir log. */
    private readonly terakhir = new Map<KodePekerjaan, Catatan>();

    /**
     * Sekali dicatat, alasan yang sama diam selama 6 jam.
     *
     * Kenapa bukan "satu baris per putaran": penjadwal broadcast jalan tiap menit, jadi satu
     * baris per putaran = 1.440 baris sehari untuk SATU klien yang paketnya turun — log server
     * tenggelam dalam sehari dan justru itu yang membuat masalah sungguhan tidak kelihatan.
     * Pola ini dipinjam dari `social-comments.service.ts` (`lastAutoErrors`), yang sudah pakai
     * cara yang sama untuk galat sinkron tiap 5 menit.
     */
    private static readonly ULANGI_MS = 6 * 60 * 60 * 1000;

    constructor(private readonly lisensi: LisensiService) {}

    /**
     * Boleh jalan? `true` juga berarti "tidak tahu" — lihat kotak di atas berkas.
     *
     * Efek sampingnya cuma satu baris log, dan itu pun ditahan supaya tidak berulang.
     */
    bolehJalan(kode: KodePekerjaan): boolean {
        try {
            const putusan = putusanTerjadwal(this.lisensi.keadaan(), kode);
            if (putusan.boleh) {
                this.catatPulih(kode);
                return true;
            }
            this.catatLewat(kode, putusan);
            return false;
        } catch (e: unknown) {
            // ATURAN 4: pemeriksaannya sendiri yang rusak tidak boleh mematikan penjadwal.
            // Dicatat sebagai error (ini memang bug yang harus diperbaiki), lalu jalan terus.
            const pesan = e instanceof Error ? e.message : String(e);
            this.log.error(
                `Pemeriksaan lisensi untuk pekerjaan '${kode}' gagal (${pesan}) — pekerjaannya ` +
                    'DIJALANKAN seperti biasa. Perbaiki penyebabnya, jangan matikan penjadwalnya.',
            );
            return true;
        }
    }

    /**
     * Keterangan untuk halaman/dasbor yang mau menampilkan "kenapa broadcast tidak jalan".
     * Tidak mencatat apa pun, jadi aman dipanggil dari mana saja.
     */
    putusan(kode: KodePekerjaan): PutusanTerjadwal {
        return putusanTerjadwal(this.lisensi.keadaan(), kode);
    }

    private catatLewat(kode: KodePekerjaan, putusan: PutusanTerjadwal): void {
        const kunciAlasan = `${putusan.alasan}:${putusan.fiturKurang.join(',')}:${putusan.paket ?? '-'}`;
        const sebelum = this.terakhir.get(kode);
        const sekarang = Date.now();
        const berubah = sebelum?.kunciAlasan !== kunciAlasan;
        if (!berubah && sekarang - sebelum!.pada < PenjagaTerjadwal.ULANGI_MS) return;
        this.terakhir.set(kode, { kunciAlasan, pada: sekarang });
        this.log.warn(putusan.catatan ?? `Pekerjaan '${kode}' dilewati.`);
    }

    private catatPulih(kode: KodePekerjaan): void {
        if (!this.terakhir.delete(kode)) return;
        this.log.log(`${PEKERJAAN_TERJADWAL[kode]?.nama ?? kode} jalan lagi (lisensinya sudah cocok).`);
    }
}

/**
 * Tipe untuk parameter konstruktor di service yang dijaga.
 *
 * Parameternya sengaja `@Optional()` + opsional di semua call site, dan itu keputusan sadar:
 * - `LisensiModule` itu `@Global`, jadi di aplikasi sungguhan penjaga ini SELALU tersuntik;
 *   yang menjaga itu `penjaga-terjadwal.spec.ts` ("modul menyediakan PenjagaTerjadwal").
 * - Tapi belasan tes lama membangun service-nya langsung (`new BroadcastService(prisma, cloud)`)
 *   untuk menguji hal yang sama sekali bukan lisensi. Menjadikan parameter ini wajib berarti
 *   memaksa semua tes itu ikut tahu soal lisensi, dan tes yang harus diubah tiap kali ada
 *   dependensi baru adalah tes yang cepat atau lambat dimatikan orang.
 * - Dan kalaupun suatu hari benar-benar tidak tersuntik, hasilnya GAGAL-TERBUKA: pekerjaannya
 *   jalan seperti sebelum penegakan ini ada. Itu arah kegagalan yang benar.
 */
export type PenjagaTerjadwalOpsional = PenjagaTerjadwal | undefined;

/**
 * "Pekerjaan ini harus dilewati?" — SATU-SATUNYA cara yang benar memanggil penjaga dari sebuah
 * penjadwal. Tanpa penjaga (tes lama, modul yang dirakit sendiri) jawabannya `false` = jalan
 * seperti biasa, gagal-terbuka.
 *
 * Jangan diganti dengan `!penjaga?.bolehJalan(kode)` di call site: itu terbaca sama tapi
 * artinya kebalikan saat penjaganya undefined (lihat catatan di atas berkas).
 */
export function lewatiKarenaLisensi(penjaga: PenjagaTerjadwalOpsional, kode: KodePekerjaan): boolean {
    if (!penjaga) return false;
    return !penjaga.bolehJalan(kode);
}
