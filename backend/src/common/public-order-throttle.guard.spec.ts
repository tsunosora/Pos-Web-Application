import { HttpException } from '@nestjs/common';
import { PublicOrderThrottleGuard } from './public-order-throttle.guard';

/** ExecutionContext tiruan: hanya `switchToHttp().getRequest()` yang dipakai guard. */
const konteks = (headers: Record<string, string> = {}, ip = '203.0.113.9') =>
    ({
        switchToHttp: () => ({ getRequest: () => ({ headers, ip, socket: { remoteAddress: ip } }) }),
    }) as any;

const status = (fn: () => void): number | 'lolos' => {
    try {
        fn();
        return 'lolos' as const;
    } catch (e) {
        return e instanceof HttpException ? e.getStatus() : -1;
    }
};

describe('PublicOrderThrottleGuard — kunci asal order', () => {
    const TOKEN = 'token-uji-rahasia-1234567890';
    let envAsli: string | undefined;

    beforeEach(() => {
        envAsli = process.env.STOREFRONT_TOKEN;
    });
    afterEach(() => {
        if (envAsli === undefined) delete process.env.STOREFRONT_TOKEN;
        else process.env.STOREFRONT_TOKEN = envAsli;
    });

    describe('env STOREFRONT_TOKEN kosong (perilaku lama)', () => {
        beforeEach(() => { delete process.env.STOREFRONT_TOKEN; });

        it('order tanpa header token tetap diterima', () => {
            const g = new PublicOrderThrottleGuard();
            expect(g.canActivate(konteks())).toBe(true);
        });

        it('masih dibatasi per IP (15/menit)', () => {
            const g = new PublicOrderThrottleGuard();
            for (let i = 0; i < 15; i++) g.canActivate(konteks());
            expect(status(() => g.canActivate(konteks()))).toBe(429);
        });
    });

    describe('env STOREFRONT_TOKEN terisi', () => {
        beforeEach(() => { process.env.STOREFRONT_TOKEN = TOKEN; });

        it('tanpa header token → 403 (bot yang menembak API langsung)', () => {
            const g = new PublicOrderThrottleGuard();
            expect(status(() => g.canActivate(konteks()))).toBe(403);
        });

        it('token salah → 403', () => {
            const g = new PublicOrderThrottleGuard();
            expect(status(() => g.canActivate(konteks({ 'x-storefront-token': 'salah' })))).toBe(403);
        });

        it('token benar → diterima', () => {
            const g = new PublicOrderThrottleGuard();
            expect(g.canActivate(konteks({ 'x-storefront-token': TOKEN, 'x-client-ip': '180.0.0.7' }))).toBe(true);
        });

        it('token benar memakai kuota per-customer (5/menit per IP customer)', () => {
            const g = new PublicOrderThrottleGuard();
            const h = { 'x-storefront-token': TOKEN, 'x-client-ip': '180.0.0.7' };
            for (let i = 0; i < 5; i++) g.canActivate(konteks(h));
            expect(status(() => g.canActivate(konteks(h)))).toBe(429);
            // Customer lain (IP asli berbeda) tidak ikut terblokir.
            expect(g.canActivate(konteks({ ...h, 'x-client-ip': '180.0.0.8' }))).toBe(true);
        });

        it('token benar tanpa x-client-ip tetap diterima (limit per IP soket)', () => {
            const g = new PublicOrderThrottleGuard();
            expect(g.canActivate(konteks({ 'x-storefront-token': TOKEN }))).toBe(true);
        });
    });
});
