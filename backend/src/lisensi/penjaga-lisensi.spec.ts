/**
 * Tes dua penjaga yang benar-benar menolak permintaan. Tanpa Nest, tanpa DB, tanpa jaringan:
 * LisensiService-nya dipalsukan, yang diuji cuma keputusan penjaganya.
 *
 * Yang paling penting di sini: kasus GAGAL-TERBUKA. Kalau tes "tanpa kunci semua lewat" ini
 * gagal, jangan diakali — itu tanda instalasi yang sudah jalan produksi akan ikut terkunci.
 */
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Keadaan } from './keadaan-lisensi';
import { FiturGuard } from './fitur.guard';
import { HanyaBacaGuard } from './hanya-baca.guard';
import { LisensiService } from './lisensi.service';

const KEADAAN_KOSONG: Keadaan = {
    ditegakkan: false,
    status: 'tanpa_lisensi',
    hanyaBaca: false,
    alasan: null,
    jamMundur: false,
    klien: null,
    namaKlien: null,
    produk: null,
    paket: null,
    fitur: [],
    batas: {},
    berlakuSampai: null,
    tenggangSampai: null,
    sisaHari: null,
    sisaHariTenggang: null,
    terakhirTerlihat: null,
};

/** LisensiService palsu: cuma perlu keadaan() + punyaFitur(), sama seperti yang dipakai penjaga. */
function lisensiPalsu(ubah: Partial<Keadaan> = {}): LisensiService {
    const keadaan: Keadaan = { ...KEADAAN_KOSONG, ...ubah };
    return {
        keadaan: () => keadaan,
        punyaFitur: (kode: string) => (keadaan.ditegakkan ? keadaan.fitur.includes(kode) : true),
    } as unknown as LisensiService;
}

const ctxHttp = (metode: string, jalur: string) =>
    ({
        getType: () => 'http',
        getHandler: () => null,
        getClass: () => null,
        switchToHttp: () => ({ getRequest: () => ({ method: metode, path: jalur }) }),
    }) as any;

const reflektor = (kode?: string[]) => ({ getAllAndOverride: () => kode }) as unknown as Reflector;

describe('HanyaBacaGuard', () => {
    it('GAGAL-TERBUKA: tanpa kunci lisensi, menulis tetap boleh', () => {
        const g = new HanyaBacaGuard(lisensiPalsu());
        expect(g.canActivate(ctxHttp('POST', '/transactions'))).toBe(true);
        expect(g.canActivate(ctxHttp('DELETE', '/products/9'))).toBe(true);
    });

    it('lisensi aktif & masa tenggang: menulis boleh', () => {
        expect(
            new HanyaBacaGuard(lisensiPalsu({ ditegakkan: true, status: 'aktif' })).canActivate(
                ctxHttp('POST', '/transactions'),
            ),
        ).toBe(true);
        expect(
            new HanyaBacaGuard(lisensiPalsu({ ditegakkan: true, status: 'tenggang' })).canActivate(
                ctxHttp('POST', '/transactions'),
            ),
        ).toBe(true);
    });

    const habis = () =>
        new HanyaBacaGuard(
            lisensiPalsu({
                ditegakkan: true,
                status: 'hanya_baca',
                hanyaBaca: true,
                alasan: 'masa_berlaku_habis',
            }),
        );

    it('hanya-baca: membaca & mencetak tetap jalan', () => {
        const g = habis();
        expect(g.canActivate(ctxHttp('GET', '/transactions'))).toBe(true);
        expect(g.canActivate(ctxHttp('GET', '/reports/daily'))).toBe(true);
        expect(g.canActivate(ctxHttp('HEAD', '/products'))).toBe(true);
        expect(g.canActivate(ctxHttp('OPTIONS', '/products'))).toBe(true);
    });

    it('hanya-baca: membuat data baru ditolak 403 dengan pesan yang bisa dibaca orang', () => {
        const g = habis();
        expect(() => g.canActivate(ctxHttp('POST', '/transactions'))).toThrow(ForbiddenException);
        try {
            g.canActivate(ctxHttp('PATCH', '/products/1'));
            throw new Error('seharusnya ditolak');
        } catch (e) {
            const isi = (e as ForbiddenException).getResponse() as Record<string, unknown>;
            expect(isi.kode).toBe('lisensi_hanya_baca');
            expect(String(isi.message)).toContain('HANYA-BACA');
        }
    });

    it('hanya-baca: login, PIN papan, penyegaran lisensi, dan webhook tetap boleh', () => {
        const g = habis();
        expect(g.canActivate(ctxHttp('POST', '/auth/login'))).toBe(true);
        expect(g.canActivate(ctxHttp('POST', '/print-queue/pin/verify'))).toBe(true);
        expect(g.canActivate(ctxHttp('POST', '/production/pin/verify'))).toBe(true);
        expect(g.canActivate(ctxHttp('POST', '/integrations/staff-pin/verify'))).toBe(true);
        expect(g.canActivate(ctxHttp('POST', '/saya/lisensi/segarkan'))).toBe(true);
        expect(g.canActivate(ctxHttp('POST', '/webhook/github'))).toBe(true);
        expect(g.canActivate(ctxHttp('POST', '/whatsapp/webhook'))).toBe(true);
    });
});

describe('FiturGuard', () => {
    it('endpoint tanpa @ButuhFitur selalu lewat', () => {
        const g = new FiturGuard(reflektor(undefined), lisensiPalsu({ ditegakkan: true, fitur: [] }));
        expect(g.canActivate(ctxHttp('GET', '/products'))).toBe(true);
    });

    it('GAGAL-TERBUKA: tanpa kunci lisensi, fitur berpenjaga tetap boleh dipakai', () => {
        const g = new FiturGuard(reflektor(['production.board']), lisensiPalsu());
        expect(g.canActivate(ctxHttp('GET', '/production/jobs'))).toBe(true);
    });

    it('fitur ada di kunci → lewat; tidak ada → 403 yang menyebut kode fiturnya', () => {
        const punya = new FiturGuard(
            reflektor(['production.board']),
            lisensiPalsu({ ditegakkan: true, paket: 'produksi', fitur: ['production.board'] }),
        );
        expect(punya.canActivate(ctxHttp('GET', '/production/jobs'))).toBe(true);

        const tanpa = new FiturGuard(
            reflektor(['ai.studio']),
            lisensiPalsu({ ditegakkan: true, paket: 'usaha', fitur: ['pos.core'] }),
        );
        try {
            tanpa.canActivate(ctxHttp('POST', '/studio-ai/ideas'));
            throw new Error('seharusnya ditolak');
        } catch (e) {
            const isi = (e as ForbiddenException).getResponse() as Record<string, unknown>;
            expect(isi.kode).toBe('lisensi_fitur_tidak_ada');
            expect(isi.fitur).toEqual(['ai.studio']);
            expect(String(isi.message)).toContain('ai.studio');
            expect(String(isi.message)).toContain('usaha');
        }
    });

    it('hanya-baca tidak mematikan fitur: yang diblokir cuma penulisan', () => {
        const g = new FiturGuard(
            reflektor(['print.queue']),
            lisensiPalsu({ ditegakkan: true, status: 'hanya_baca', hanyaBaca: true, fitur: ['print.queue'] }),
        );
        expect(g.canActivate(ctxHttp('GET', '/print-queue/jobs'))).toBe(true);
    });
});
