/**
 * `/langganan/*` — yang dipanggil halaman Pengaturan → Langganan.
 *
 * SEMUA jalur di sini WAJIB `JwtAuthGuard` + `OwnerGuard`. Bukan `ManagerGuard`: manajer dan
 * kepala produksi tidak ada urusan dengan tagihan dan paket, dan endpoint ini bisa menaikkan
 * paket (= menambah tagihan). `OwnerGuard` adalah yang paling ketat di repo ini
 * (`auth/role-groups.ts`): owner / pemilik / superadmin saja.
 *
 * Jawaban ke browser TIDAK PERNAH memuat token instalasi — token cuma dibaca di
 * `LanggananService` dan ditempel ke header permintaan keluar. Lihat komentar di sana.
 *
 * Catatan: jalur ini dikecualikan dari `HanyaBacaGuard` (lihat `lisensi/hanya-baca.guard.ts`).
 * Kalau tidak, lisensi yang habis masa membuat halaman ini ikut mati — padahal halaman inilah
 * jalan keluarnya: bayar tagihan, lalu segarkan kunci.
 */
import { Body, Controller, Delete, Get, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OwnerGuard } from '../auth/role-groups';
import { LisensiService } from '../lisensi/lisensi.service';
import { LanggananService } from './langganan.service';

@Controller('langganan')
@UseGuards(JwtAuthGuard, OwnerGuard)
export class LanggananController {
    constructor(
        private readonly langganan: LanggananService,
        private readonly lisensi: LisensiService,
    ) {}

    /**
     * Seluruh isi halaman dalam satu panggilan.
     *
     * Belum tersambung = jawaban 200 dengan `tersambung:false`, BUKAN galat. Instalasi lama dan
     * lingkungan pengembangan memang begitu, dan halaman yang meledak di keadaan normal cuma
     * bikin orang mengira ada yang rusak.
     */
    @Get()
    async ringkasan() {
        if (!this.langganan.tersambung()) {
            return {
                tersambung: false,
                pesan:
                    'Instalasi ini belum tersambung ke akun Qendali, jadi langganannya belum bisa ' +
                    'dilihat atau diatur dari sini. Tidak ada yang perlu kamu lakukan — kalau memang ' +
                    'seharusnya tersambung, hubungi Qendali lewat WhatsApp.',
            };
        }
        const data = await this.langganan.panggil<Record<string, unknown>>('GET', 'langganan');
        return { tersambung: true, ...data };
    }

    /**
     * Ganti paket / pasang / lepas add-on.
     * Angka dan akibatnya sudah dihitung penerbit — aplikasi ini tidak menghitung apa pun.
     */
    @Post('perubahan')
    async ajukanPerubahan(@Body() badan: { jenis?: string; paket?: string; tambahan?: string }) {
        const hasil = await this.langganan.panggil<Record<string, unknown>>('POST', 'perubahan', badan);
        // Perubahan yang LANGSUNG berlaku (masa coba, atau lepas add-on yang gratis) mengubah isi
        // kunci. Tarik kunci baru sekarang supaya menunya langsung ikut, tanpa menunggu jadwal
        // harian. Gagal menyegarkan bukan masalah: `segarkan()` tidak pernah melempar galat.
        if (hasil?.status === 'diterapkan') await this.lisensi.segarkan('manual');
        return hasil;
    }

    /** Batalkan perubahan yang belum berlaku. */
    @Delete('perubahan')
    async batalkanPerubahan() {
        return this.langganan.panggil('DELETE', 'perubahan');
    }

    /**
     * "Saya sudah transfer" — memindahkan tagihan ke `menunggu_verifikasi`, BUKAN lunas.
     * Yang melunaskan cuma Qendali setelah melihat mutasi bank. Aturan itu ada di sisi penerbit;
     * di sini cuma diteruskan, jangan pernah ditebak-tebak sendiri.
     */
    @Post('tagihan')
    async sudahTransfer(@Body() badan: { id?: number; catatan?: string }) {
        return this.langganan.panggil('POST', 'tagihan', badan);
    }

    @Get('domain')
    async domain() {
        return this.langganan.panggil('GET', 'domain');
    }

    /** Pasang / ganti domain sendiri. Jawabannya memuat petunjuk record DNS dari penerbit. */
    @Put('domain')
    async pasangDomain(@Body() badan: { nama?: string }) {
        return this.langganan.panggil('PUT', 'domain', badan);
    }

    /** Periksa CNAME sekarang. Penerbit membatasi sekali per 15 detik (jawabannya 409). */
    @Post('domain/periksa')
    async periksaDomain() {
        return this.langganan.panggil('POST', 'domain');
    }

    @Delete('domain')
    async lepasDomain() {
        return this.langganan.panggil('DELETE', 'domain');
    }
}
