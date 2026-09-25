/**
 * Modul lisensi Qendali.
 *
 * @Global supaya `LisensiService` bisa disuntik di modul mana pun tanpa menambah `imports`
 * satu per satu — penegakan lisensi menyentuh banyak tempat, dan setiap `imports` yang harus
 * diingat manusia adalah satu tempat yang bisa lupa.
 *
 * Dua penjaga dipasang GLOBAL (APP_GUARD):
 * - `FiturGuard`    — diam untuk endpoint tanpa `@ButuhFitur`, jadi aman dipasang menyeluruh.
 * - `HanyaBacaGuard`— menolak penulisan saat lisensi kedaluwarsa melewati tenggang.
 * Keduanya tidak melakukan apa pun selama tidak ada kunci lisensi (gagal-terbuka), jadi
 * memasang modul ini TIDAK mengubah perilaku instalasi yang sekarang jalan produksi.
 */
import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { FiturGuard } from './fitur.guard';
import { HanyaBacaGuard } from './hanya-baca.guard';
import { LisensiController } from './lisensi.controller';
import { LisensiService } from './lisensi.service';

@Global()
@Module({
    controllers: [LisensiController],
    providers: [
        LisensiService,
        { provide: APP_GUARD, useClass: HanyaBacaGuard },
        { provide: APP_GUARD, useClass: FiturGuard },
    ],
    exports: [LisensiService],
})
export class LisensiModule {}
