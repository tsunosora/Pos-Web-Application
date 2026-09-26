/**
 * SATU tempat pemeriksa batas angka lisensi. Semua endpoint yang menambah sesuatu yang dibatasi
 * paket memanggil `wajibBolehMenambah()` dari sini — jangan pernah menyalin logikanya ke
 * controller, nanti dua tempat menghitung "aktif" dengan cara yang beda dan klien ditolak
 * padahal belum penuh.
 *
 * Keputusan pemiliknya (klien lewat batas dibiarkan, nol ≠ tanpa batas, gagal-terbuka) ada di
 * `aturan-batas.ts`. Di sini cuma dua hal: MENGHITUNG pemakaian sekarang, dan MELEMPAR 403.
 *
 * ┌─────────────────────────────────────────────────────────────────────────────────────┐
 * │ YANG DIHITUNG HANYA YANG AKTIF.                                                      │
 * │                                                                                     │
 * │ Salah hitung ke atas lebih merusak daripada tidak menegakkan sama sekali: klien yang │
 * │ sebenarnya masih punya sisa slot tiba-tiba ditolak, lalu dia menelepon marah dan     │
 * │ kamu tidak punya jawaban. Jadi:                                                     │
 * │                                                                                     │
 * │ - Pengguna → `users.is_active = true`. Karyawan yang keluar TIDAK dihapus (lihat     │
 * │   `users.service.ts` → `setStatus`: `isActive=false` + `resignedAt`, supaya riwayat  │
 * │   lead/kas/tugasnya tetap utuh di laporan). Menghitung semua baris `users` berarti    │
 * │   menagih klien untuk orang yang resign dua tahun lalu.                             │
 * │ - Cabang → `company_branches.is_active = true`. Cabang yang sudah punya riwayat      │
 * │   memang TIDAK BISA dihapus (lihat `company-branches.service.ts` → `remove`), jadi    │
 * │   satu-satunya cara "menutup cabang" adalah menonaktifkannya. Kalau yang nonaktif    │
 * │   ikut dihitung, klien yang menutup satu cabang tidak akan pernah bisa buka cabang   │
 * │   baru lagi.                                                                        │
 * │ - `limit.branches` = model **CompanyBranch**, BUKAN model `Branch`. `Branch` itu      │
 * │   titik di Peta Cuan (lat/long + omzet pesaing) yang bisa diisi puluhan baris untuk   │
 * │   riset lokasi — sama sekali bukan cabang yang dilisensi. Tertukar di sini = klien    │
 * │   satu outlet ditolak menambah pengguna karena dia rajin memetakan pesaing.          │
 * └─────────────────────────────────────────────────────────────────────────────────────┘
 */
import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { KODE_BATAS_DITEGAKKAN, PutusanBatas, putusanBatas } from './aturan-batas';
import { LisensiService } from './lisensi.service';

/**
 * Cara menghitung pemakaian per kode batas. `prisma` sengaja `any` — mengikuti pola yang sudah
 * dipakai seluruh repo untuk `companyBranch` (lihat `company-branches.service.ts`).
 */
const CARA_HITUNG: Readonly<Record<string, (prisma: any) => Promise<number>>> = {
    'limit.users': (prisma) => prisma.user.count({ where: { isActive: true } }),
    'limit.branches': (prisma) => prisma.companyBranch.count({ where: { isActive: true } }),
};

@Injectable()
export class BatasService {
    private readonly log = new Logger('Lisensi');

    constructor(
        private readonly prisma: PrismaService,
        private readonly lisensi: LisensiService,
    ) {}

    /**
     * Berapa yang terpakai sekarang untuk satu kode batas. Melempar kalau kodenya tidak punya
     * cara hitung — itu salah tulis programmer, bukan keadaan yang mungkin terjadi di produksi.
     */
    async hitungPemakaian(kode: string): Promise<number> {
        const cara = CARA_HITUNG[kode];
        if (!cara) throw new Error(`Batas '${kode}' belum punya cara menghitung pemakaian.`);
        return cara(this.prisma as any);
    }

    /**
     * Putusan untuk satu kode batas: batas dari kunci + pemakaian sekarang.
     *
     * Tanpa batas (null) → TIDAK menyentuh database sama sekali. Itu jalur normal untuk
     * instalasi tanpa kunci, lingkungan pengembangan, dan paket yang memang tanpa batas —
     * jangan menambahkan satu query pun ke jalur itu.
     */
    async periksa(kode: string): Promise<PutusanBatas> {
        const keadaan = this.lisensi.keadaan();
        const batas = this.lisensi.batasFitur(kode);
        if (batas === null) return putusanBatas({ kode, batas: null, pemakaian: 0, paket: keadaan.paket });

        let pemakaian: number;
        try {
            pemakaian = await this.hitungPemakaian(kode);
        } catch (e: unknown) {
            // GAGAL-TERBUKA juga di sini. Menolak penambahan karena HITUNGANNYA gagal berarti
            // menolak orang tanpa tahu dia sudah penuh atau belum — dan penulisan yang dia
            // lakukan berikutnya akan gagal sendiri kalau database-nya memang bermasalah.
            const pesan = e instanceof Error ? e.message : String(e);
            this.log.warn(`Gagal menghitung pemakaian ${kode}: ${pesan}. Batas dilewati (gagal-terbuka).`);
            return putusanBatas({ kode, batas: null, pemakaian: 0, paket: keadaan.paket });
        }

        return putusanBatas({ kode, batas, pemakaian, paket: keadaan.paket });
    }

    /**
     * Tolak kalau jumlahnya sudah menyentuh batas paket. Dipanggil PERSIS sebelum baris baru
     * dibuat, sesudah semua pemeriksaan wewenang — supaya orang yang memang tidak berhak tidak
     * ikut diberi tahu berapa jumlah pengguna klien ini.
     *
     * Hanya untuk PENAMBAHAN. Jangan pernah dipanggil di endpoint ubah/hapus: klien yang sudah
     * lewat batas harus tetap bisa merapikan datanya (justru itu jalan keluarnya).
     */
    async wajibBolehMenambah(kode: string): Promise<PutusanBatas> {
        const putusan = await this.periksa(kode);
        if (putusan.boleh) return putusan;

        this.log.warn(
            `Batas ${kode} penuh (${putusan.pemakaian}/${putusan.batas}) — penambahan ditolak. ` +
                'Data yang sudah ada tidak disentuh.',
        );
        throw new ForbiddenException({
            statusCode: 403,
            error: 'Forbidden',
            kode: 'lisensi_batas_penuh',
            batas: { kode, nilai: putusan.batas, pemakaian: putusan.pemakaian },
            message: putusan.pesan,
        });
    }

    /**
     * Pemakaian semua batas yang ditegakkan, untuk ditumpangkan ke `GET /saya/fitur` supaya
     * halaman Langganan bisa menulis "Pengguna: 4 dari 5".
     *
     * Penegakan mati → `{}`, tanpa satu pun query. Satu kode yang gagal dihitung juga cukup
     * dilewati: halaman langganan yang kurang satu baris jauh lebih baik daripada `/saya/fitur`
     * yang menjawab galat, karena jawaban galat di endpoint itu membuat SEMUA menu muncul
     * (gagal-terbuka) dan orang mengira paketnya berubah.
     */
    async ringkasanPemakaian(): Promise<Record<string, number>> {
        if (!this.lisensi.keadaan().ditegakkan) return {};

        const hasil: Record<string, number> = {};
        for (const kode of KODE_BATAS_DITEGAKKAN) {
            if (this.lisensi.batasFitur(kode) === null) continue; // tanpa batas: tidak perlu dihitung
            try {
                hasil[kode] = await this.hitungPemakaian(kode);
            } catch (e: unknown) {
                const pesan = e instanceof Error ? e.message : String(e);
                this.log.warn(`Gagal menghitung pemakaian ${kode} untuk /saya/fitur: ${pesan}.`);
            }
        }
        return hasil;
    }
}
