import { HttpException, NotFoundException } from '@nestjs/common';
import { StorefrontReadGuard } from './storefront-read.guard';
import { StorefrontService } from './storefront.service';

const konteks = (headers: Record<string, string> = {}, ip = '203.0.113.5') =>
    ({ switchToHttp: () => ({ getRequest: () => ({ headers, ip, socket: { remoteAddress: ip } }) }) }) as any;

const status = (fn: () => void): number | 'lolos' => {
    try {
        fn();
        return 'lolos' as const;
    } catch (e) {
        return e instanceof HttpException ? e.getStatus() : -1;
    }
};

describe('StorefrontReadGuard', () => {
    const TOKEN = 'read-token-uji-0123456789abcdef';
    let asli: string | undefined;
    beforeEach(() => { asli = process.env.STOREFRONT_READ_TOKEN; });
    afterEach(() => {
        if (asli === undefined) delete process.env.STOREFRONT_READ_TOKEN;
        else process.env.STOREFRONT_READ_TOKEN = asli;
    });

    it('env kosong → endpoint mati (403), walau header dikirim', () => {
        delete process.env.STOREFRONT_READ_TOKEN;
        const g = new StorefrontReadGuard();
        expect(status(() => g.canActivate(konteks()))).toBe(403);
        expect(status(() => g.canActivate(konteks({ 'x-storefront-read-token': TOKEN })))).toBe(403);
    });

    it('token salah / tanpa header → 403', () => {
        process.env.STOREFRONT_READ_TOKEN = TOKEN;
        const g = new StorefrontReadGuard();
        expect(status(() => g.canActivate(konteks()))).toBe(403);
        expect(status(() => g.canActivate(konteks({ 'x-storefront-read-token': 'salah' })))).toBe(403);
    });

    it('token benar → lolos, dan dibatasi 60 permintaan/menit per IP', () => {
        process.env.STOREFRONT_READ_TOKEN = TOKEN;
        const g = new StorefrontReadGuard();
        const h = { 'x-storefront-read-token': TOKEN };
        for (let i = 0; i < 60; i++) expect(g.canActivate(konteks(h))).toBe(true);
        expect(status(() => g.canActivate(konteks(h)))).toBe(429);
        // IP lain tidak ikut terblokir.
        expect(g.canActivate(konteks(h, '203.0.113.6'))).toBe(true);
    });

    it('kunci baca TERPISAH dari kunci kirim order', () => {
        process.env.STOREFRONT_READ_TOKEN = TOKEN;
        process.env.STOREFRONT_TOKEN = 'token-kirim-order-berbeda';
        const g = new StorefrontReadGuard();
        expect(status(() => g.canActivate(konteks({ 'x-storefront-read-token': 'token-kirim-order-berbeda' })))).toBe(403);
        delete process.env.STOREFRONT_TOKEN;
    });
});

describe('StorefrontService — hanya lead WEBSITE & kolom terbatas', () => {
    const buat = () => {
        const lead = {
            findMany: jest.fn().mockResolvedValue([]),
            count: jest.fn().mockResolvedValue(0),
            findFirst: jest.fn().mockResolvedValue(null),
            groupBy: jest.fn().mockResolvedValue([{ status: 'NEW', _count: { _all: 3 } }]),
        };
        return { svc: new StorefrontService({ lead } as any), lead };
    };

    it('daftar selalu menyaring source WEBSITE & membatasi limit 1..200', async () => {
        const { svc, lead } = buat();
        await svc.daftar({ limit: 5000 });
        expect(lead.findMany.mock.calls[0][0].where).toEqual({ source: 'WEBSITE' });
        expect(lead.findMany.mock.calls[0][0].take).toBe(200);
        await svc.daftar({ limit: 0 });
        expect(lead.findMany.mock.calls[1][0].take).toBe(50); // 0/kosong = pakai bawaan
        await svc.daftar({ limit: -5 });
        expect(lead.findMany.mock.calls[2][0].take).toBe(1);
    });

    it('hanya mengirim kolom yang dipakai website (tanpa catatan internal/cabang/staf)', async () => {
        const { svc, lead } = buat();
        await svc.daftar({});
        const pilih = lead.findMany.mock.calls[0][0].select;
        expect(Object.keys(pilih).sort()).toEqual(
            ['createdAt', 'city', 'estimatedValue', 'id', 'items', 'name', 'needs', 'phone', 'status'].sort(),
        );
        expect(Object.keys(pilih.items.select).sort()).toEqual(
            ['description', 'heightCm', 'productVariant', 'quantity', 'unitPrice', 'unitType', 'widthCm'].sort(),
        );
    });

    it('filter status hanya menerima nilai yang dikenal', async () => {
        const { svc, lead } = buat();
        await svc.daftar({ status: 'CLOSED_WON' });
        expect(lead.findMany.mock.calls[0][0].where).toEqual({ source: 'WEBSITE', status: 'CLOSED_WON' });
        await svc.daftar({ status: 'INVALID' }); // tidak ditawarkan ke website
        expect(lead.findMany.mock.calls[1][0].where).toEqual({ source: 'WEBSITE' });
        await svc.daftar({ status: "'; DROP TABLE leads; --" });
        expect(lead.findMany.mock.calls[2][0].where).toEqual({ source: 'WEBSITE' });
    });

    it('detail lead non-WEBSITE → 404', async () => {
        const { svc, lead } = buat();
        await expect(svc.detail(12)).rejects.toBeInstanceOf(NotFoundException);
        expect(lead.findFirst.mock.calls[0][0].where).toEqual({ id: 12, source: 'WEBSITE' });
        await expect(svc.detail(-1)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('ringkasan status hanya menghitung lead WEBSITE & selalu memuat semua status', async () => {
        const { svc, lead } = buat();
        const r = await svc.ringkasanStatus();
        expect(lead.groupBy.mock.calls[0][0].where).toEqual({ source: 'WEBSITE' });
        expect(r).toEqual({ NEW: 3, FOLLOW_UP: 0, NEGOTIATION: 0, CLOSED_WON: 0, CLOSED_LOST: 0 });
    });
});
