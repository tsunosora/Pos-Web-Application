/**
 * Penjaga mode HANYA-BACA: saat lisensi habis masa berlakunya DAN masa tenggangnya lewat,
 * semua permintaan yang membuat/mengubah data (POST/PUT/PATCH/DELETE) ditolak — sementara
 * membaca, mencari, dan mencetak data lama tetap jalan seperti biasa.
 *
 * Aturannya dari `docs/lisensi.md`: "Habis masa = hanya-baca, bukan mati. Kasir yang sedang
 * melayani pelanggan tidak peduli soal tagihan." Berlaku sama saat klien turun paket.
 *
 * Yang DIKECUALIKAN, dan alasannya:
 * - `/auth/**` dan semua `…/pin/verify` — kalau masuk pun tidak bisa, tidak ada yang bisa
 *   membaca data lama. Login itu pintu ke mode baca, bukan penulisan data usaha.
 * - `/saya/lisensi/segarkan` — satu-satunya jalan KELUAR dari hanya-baca (setelah bayar).
 *   Kalau ini ikut diblokir, pemilik harus restart server hanya untuk memperbarui kunci.
 * - webhook pihak luar (`/webhook/**`, `/whatsapp/webhook`, `/social/**`) — Meta & GitHub
 *   mematikan langganan webhook kalau terus dijawab galat, dan itu kerusakan yang bertahan
 *   lama setelah tagihan dibayar. Sama dengan daftar di `common/tolak-tulisan-bersarang.ts`.
 *
 * Penegakan ada DI SINI, di backend — bukan dengan menyembunyikan tombol di frontend.
 */
import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { LisensiService } from './lisensi.service';

const METODE_BACA = new Set(['GET', 'HEAD', 'OPTIONS']);

const JALUR_BEBAS = [
    /^\/auth(\/|$)/,
    /\/pin\/verify$/, // papan produksi & papan cetak: /production/pin/verify, /print-queue/pin/verify
    /\/staff-pin\/verify$/,
    /^\/saya\/lisensi\/segarkan$/,
    /^\/webhook\//,
    /^\/whatsapp\/webhook/,
    /^\/social\//,
];

@Injectable()
export class HanyaBacaGuard implements CanActivate {
    private readonly log = new Logger('Lisensi');

    constructor(private readonly lisensi: LisensiService) {}

    canActivate(context: ExecutionContext): boolean {
        if (context.getType() !== 'http') return true;
        const req = context.switchToHttp().getRequest<{ method?: string; path?: string; url?: string }>();
        const metode = String(req?.method ?? '').toUpperCase();
        if (METODE_BACA.has(metode)) return true;

        const keadaan = this.lisensi.keadaan();
        // Tanpa kunci → penegakan mati. Aktif/tenggang → menulis tetap boleh.
        if (!keadaan.ditegakkan || !keadaan.hanyaBaca) return true;

        const jalur = String(req?.path ?? req?.url ?? '');
        if (JALUR_BEBAS.some((re) => re.test(jalur))) return true;

        this.log.warn(`Hanya-baca: ${metode} ${jalur} ditolak (${keadaan.alasan ?? 'masa berlaku habis'}).`);
        throw new ForbiddenException({
            statusCode: 403,
            error: 'Forbidden',
            kode: 'lisensi_hanya_baca',
            alasan: keadaan.alasan,
            berlakuSampai: keadaan.berlakuSampai,
            message:
                'Lisensi Qendali sudah habis masa berlakunya, jadi aplikasi sedang HANYA-BACA: ' +
                'data lama tetap bisa dibuka, dicari, dan dicetak, tapi data baru belum bisa disimpan. ' +
                'Perbarui langganan di qendali.com, lalu segarkan lisensinya dari Pengaturan.',
        });
    }
}
