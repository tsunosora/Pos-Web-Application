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
import { BatasService } from './batas.service';
import { LisensiService } from './lisensi.service';

const ROLE_PEMILIK = ['OWNER', 'SUPERADMIN', 'SUPER_ADMIN'];

@Controller('saya')
export class LisensiController {
    constructor(
        private readonly lisensi: LisensiService,
        private readonly batas: BatasService,
    ) {}

    /**
     * Ringkasan + `pemakaian`: jumlah yang terpakai sekarang untuk batas yang ditegakkan, mis.
     * `{ "limit.users": 4 }`. Ditempel di sini, bukan di endpoint baru — halaman Langganan sudah
     * memanggil endpoint ini, dan satu panggilan lagi cuma menambah tempat yang bisa gagal.
     *
     * Bentuknya sengaja sama dengan `batas` (peta kode → angka) supaya keduanya gampang
     * dipasangkan di layar. Instalasi tanpa kunci menjawab `{}` — tidak ada batas, tidak ada
     * yang perlu dihitung, dan tidak ada query ke database.
     */
    private async ringkasanLengkap() {
        return { ...this.lisensi.ringkasan(), pemakaian: await this.batas.ringkasanPemakaian() };
    }

    /** Wajib login — daftar fitur & paket klien bukan informasi publik. */
    @Get('fitur')
    @UseGuards(JwtAuthGuard)
    fitur() {
        return this.ringkasanLengkap();
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
        return this.ringkasanLengkap();
    }
}
