/**
 * Uji rakitan modul: memastikan dua penjaga global + service benar-benar bisa dibangun Nest
 * (tanpa DB, tanpa jaringan). Kesalahan DI di APP_GUARD kalau tidak diuji begini baru
 * ketahuan saat aplikasi gagal naik di server klien.
 */
import { Test } from '@nestjs/testing';
import { LisensiModule } from './lisensi.module';
import { LisensiService } from './lisensi.service';
import { PenjagaTerjadwal } from './penjaga-terjadwal.service';

describe('LisensiModule', () => {
    it('merakit service + dua penjaga, dan tanpa kunci semuanya terbuka', async () => {
        const modul = await Test.createTestingModule({ imports: [LisensiModule] }).compile();

        // Penjaga global (APP_GUARD) tidak bisa diambil lewat token dari modul uji — Nest
        // memindahkannya ke konfigurasi aplikasi. Tapi keduanya tetap DIBANGUN saat compile(),
        // jadi kalau dependensinya salah (Reflector/LisensiService), baris di atas yang meledak.

        const lisensi = modul.get(LisensiService);
        // Belum ada kunci yang dimuat (onApplicationBootstrap tidak dijalankan di tes ini):
        // keadaannya harus gagal-terbuka, bukan menolak apa pun.
        expect(lisensi.keadaan().ditegakkan).toBe(false);
        expect(lisensi.hanyaBaca()).toBe(false);
        expect(lisensi.punyaFitur('ai.studio')).toBe(true);
        expect(lisensi.batasFitur('limit.users')).toBeNull();
        expect(lisensi.ringkasan()).not.toHaveProperty('kunci');

        await modul.close();
    });

    /**
     * Penjaga pekerjaan terjadwal disuntik `@Optional()` di enam service (alasannya di
     * `penjaga-terjadwal.service.ts`), jadi salah wiring TIDAK akan meledak di mana pun — cuma
     * membuat penegakannya diam-diam hilang. Tes ini satu-satunya yang menangkapnya.
     */
    it('menyediakan PenjagaTerjadwal untuk seluruh aplikasi (@Global)', async () => {
        const modul = await Test.createTestingModule({ imports: [LisensiModule] }).compile();
        const penjaga = modul.get(PenjagaTerjadwal);
        expect(penjaga).toBeInstanceOf(PenjagaTerjadwal);
        // Tanpa kunci: gagal-terbuka, jadi semua pekerjaan terjadwal boleh jalan.
        expect(penjaga.bolehJalan('wa.broadcast')).toBe(true);
        expect(penjaga.bolehJalan('sosial.komentar')).toBe(true);
        await modul.close();
    });
});
