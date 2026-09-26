/**
 * Modul halaman Pengaturan → Langganan.
 *
 * `LisensiModule` @Global, jadi `LisensiService` bisa disuntik tanpa `imports` — dipakai untuk
 * menyegarkan kunci begitu sebuah perubahan langsung berlaku.
 */
import { Module } from '@nestjs/common';
import { LanggananController } from './langganan.controller';
import { LanggananService } from './langganan.service';

@Module({
    controllers: [LanggananController],
    providers: [LanggananService],
    exports: [LanggananService],
})
export class LanggananModule {}
