/**
 * Penjaga `@ButuhFitur('kode.fitur')` — menolak endpoint yang kode fiturnya tidak ada di kunci.
 * Sekalian penjaga `@ButuhSalahSatuFitur(...)`, varian "salah satu cukup" untuk halaman campuran.
 *
 * Terpasang global, tapi TIDAK melakukan apa-apa untuk endpoint tanpa dekorator, dan tidak
 * melakukan apa-apa selama tidak ada kunci lisensi (gagal-terbuka). Jadi memasangnya ke
 * seluruh aplikasi tidak mengubah perilaku instalasi yang sudah jalan.
 *
 * Dua dekoratornya dibaca dari metadata yang BERBEDA, jadi tidak saling menimpa: kalau satu
 * handler memakai dua-duanya, dua-duanya harus lolos. Bedanya dijelaskan di
 * `butuh-fitur.decorator.ts` — dan bedanya penting: SEMUA vs SALAH SATU.
 */
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FITUR_KEY, FITUR_SALAH_SATU_KEY } from './butuh-fitur.decorator';
import { LisensiService } from './lisensi.service';

@Injectable()
export class FiturGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
        private readonly lisensi: LisensiService,
    ) {}

    canActivate(context: ExecutionContext): boolean {
        this.wajibSemua(context);
        this.wajibSalahSatu(context);
        return true;
    }

    /** `@ButuhFitur` — SEMUA kode wajib ada. */
    private wajibSemua(context: ExecutionContext): void {
        const butuh = this.baca(context, FITUR_KEY);
        if (!butuh.length) return;

        const kurang = butuh.filter((kode) => !this.lisensi.punyaFitur(kode));
        if (kurang.length === 0) return;
        this.tolak(kurang);
    }

    /**
     * `@ButuhSalahSatuFitur` — cukup SATU kode yang ada. Ditolak hanya kalau tidak ada satu pun.
     * Pesan galatnya menyebut seluruh daftar: yang membacanya perlu tahu bahwa memasang salah
     * satu saja sudah membuka halamannya, bukan mengira harus membeli ketiganya.
     */
    private wajibSalahSatu(context: ExecutionContext): void {
        const butuh = this.baca(context, FITUR_SALAH_SATU_KEY);
        if (!butuh.length) return;

        if (butuh.some((kode) => this.lisensi.punyaFitur(kode))) return;
        this.tolak(butuh, true);
    }

    private baca(context: ExecutionContext, kunci: string): string[] {
        const nilai = this.reflector.getAllAndOverride<string[] | undefined>(kunci, [
            context.getHandler(),
            context.getClass(),
        ]);
        return Array.isArray(nilai) ? nilai : [];
    }

    private tolak(kurang: string[], salahSatuCukup = false): never {
        const keadaan = this.lisensi.keadaan();
        // Pesannya ditulis untuk dibaca pemakai, dan menyebut kode fiturnya supaya kamu bisa
        // langsung mencarinya di dasbor qendali.com tanpa menebak menu mana yang dimaksud.
        throw new ForbiddenException({
            statusCode: 403,
            error: 'Forbidden',
            kode: 'lisensi_fitur_tidak_ada',
            fitur: kurang,
            salahSatuCukup,
            message:
                `Fitur ini tidak termasuk paket langganan ${keadaan.paket ?? 'yang terpasang'} ` +
                `(kode: ${kurang.join(', ')}${salahSatuCukup ? ' — salah satu saja sudah cukup' : ''}). ` +
                'Tambahkan lewat qendali.com → Pengaturan → Langganan, ' +
                'lalu segarkan kunci lisensinya.',
        });
    }
}
