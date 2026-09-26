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
 *
 * `BatasService` (batas angka: jumlah pengguna & cabang) SENGAJA bukan penjaga global: dia perlu
 * database, dan penjaga global jalan SEBELUM penjaga login di controller — jadi tamu yang belum
 * masuk pun bisa memancing jumlah pengguna klien lewat pesan galatnya. Yang memanggilnya adalah
 * service tempat penambahan terjadi, sesudah semua pemeriksaan wewenang.
 *
 * `PrismaModule` ikut di-`imports` walau dia sendiri @Global — di `app.module.ts` modul ini
 * terdaftar SEBELUM PrismaModule, dan menulis kebergantungannya terang-terangan lebih murah
 * daripada menebak urutan pemindaian Nest.
 */
import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from '../prisma/prisma.module';
import { BatasService } from './batas.service';
import { FiturGuard } from './fitur.guard';
import { HanyaBacaGuard } from './hanya-baca.guard';
import { LisensiController } from './lisensi.controller';
import { LisensiService } from './lisensi.service';

@Global()
@Module({
    imports: [PrismaModule],
    controllers: [LisensiController],
    providers: [
        LisensiService,
        BatasService,
        { provide: APP_GUARD, useClass: HanyaBacaGuard },
        { provide: APP_GUARD, useClass: FiturGuard },
    ],
    exports: [LisensiService, BatasService],
})
export class LisensiModule {}
