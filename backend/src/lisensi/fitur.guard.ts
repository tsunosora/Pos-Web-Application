/**
 * Penjaga `@ButuhFitur('kode.fitur')` — menolak endpoint yang kode fiturnya tidak ada di kunci.
 *
 * Terpasang global, tapi TIDAK melakukan apa-apa untuk endpoint tanpa dekorator, dan tidak
 * melakukan apa-apa selama tidak ada kunci lisensi (gagal-terbuka). Jadi memasangnya ke
 * seluruh aplikasi tidak mengubah perilaku instalasi yang sudah jalan.
 */
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FITUR_KEY } from './butuh-fitur.decorator';
import { LisensiService } from './lisensi.service';

@Injectable()
export class FiturGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
        private readonly lisensi: LisensiService,
    ) {}

    canActivate(context: ExecutionContext): boolean {
        const butuh = this.reflector.getAllAndOverride<string[] | undefined>(FITUR_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (!butuh || butuh.length === 0) return true;

        const kurang = butuh.filter((kode) => !this.lisensi.punyaFitur(kode));
        if (kurang.length === 0) return true;

        const keadaan = this.lisensi.keadaan();
        // Pesannya ditulis untuk dibaca pemakai, dan menyebut kode fiturnya supaya kamu bisa
        // langsung mencarinya di dasbor qendali.com tanpa menebak menu mana yang dimaksud.
        throw new ForbiddenException({
            statusCode: 403,
            error: 'Forbidden',
            kode: 'lisensi_fitur_tidak_ada',
            fitur: kurang,
            message:
                `Fitur ini tidak termasuk paket langganan ${keadaan.paket ?? 'yang terpasang'} ` +
                `(kode: ${kurang.join(', ')}). Tambahkan lewat qendali.com → Pengaturan → Langganan, ` +
                'lalu segarkan kunci lisensinya.',
        });
    }
}
