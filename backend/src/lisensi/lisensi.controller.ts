/**
 * `GET /saya/fitur` — apa yang boleh dipakai instalasi ini.
 *
 * Dipakai frontend untuk menyembunyikan menu yang tidak ada di paket dan memasang peringatan
 * "lisensi tinggal N hari". INGAT: menyembunyikan menu itu kosmetik — yang menolak sungguhan
 * adalah `FiturGuard` & `HanyaBacaGuard` di backend. Endpoint ini cuma supaya pemakai tidak
 * dibiarkan mengklik menu yang pasti 403.
 *
 * Yang TIDAK pernah dikirim: kunci mentah (`q1.…`) dan token instalasi. Kunci mentah tidak
 * rahasia, tapi mengirimnya ke browser membuatnya gampang tersalin ke pemasangan lain, dan
 * token sama sekali tidak ada urusannya dengan frontend.
 */
import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { LisensiService } from './lisensi.service';

const ROLE_PEMILIK = ['OWNER', 'SUPERADMIN', 'SUPER_ADMIN'];

@Controller('saya')
export class LisensiController {
    constructor(private readonly lisensi: LisensiService) {}

    /** Wajib login — daftar fitur & paket klien bukan informasi publik. */
    @Get('fitur')
    @UseGuards(JwtAuthGuard)
    fitur() {
        return this.lisensi.ringkasan();
    }

    /**
     * Tarik kunci terbaru sekarang, tanpa menunggu jadwal harian. Dipakai setelah tagihan
     * dibayar atau paket diganti, supaya menu baru langsung muncul.
     * Sengaja dikecualikan dari penjaga hanya-baca — ini jalan keluarnya.
     */
    @Post('lisensi/segarkan')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...ROLE_PEMILIK)
    async segarkan() {
        await this.lisensi.segarkan('manual');
        return this.lisensi.ringkasan();
    }
}
