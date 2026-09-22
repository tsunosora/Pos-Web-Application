import { cariOperatorPrisma, tolakTulisanBersarang } from './tolak-tulisan-bersarang';

describe('tolakTulisanBersarang', () => {
    const jalankan = (req: any) => {
        const res: any = { kode: 0, isi: null, status(c: number) { this.kode = c; return this; }, json(b: any) { this.isi = b; return this; } };
        let lanjut = false;
        tolakTulisanBersarang(req, res, () => { lanjut = true; });
        return { lanjut, kode: res.kode };
    };

    it('menemukan tulisan relasi bersarang (kasus /batches → role Owner)', () => {
        const body = { branch: { update: { users: { update: { where: { id: 1 }, data: { role: { connect: { name: 'Owner' } } } } } } } };
        expect(cariOperatorPrisma(body)).toBe('update');
        expect(jalankan({ method: 'PATCH', path: '/batches/1', body }).kode).toBe(400);
    });

    it('body biasa lolos, termasuk kunci bernama sama berisi nilai biasa', () => {
        expect(cariOperatorPrisma({ name: 'Banner', items: [{ qty: 2 }], update: true, set: 'x' })).toBeNull();
        expect(jalankan({ method: 'POST', path: '/transactions', body: { items: [{ productVariantId: 1 }] } }).lanjut).toBe(true);
    });

    it('operator di dalam array ikut ditolak', () => {
        expect(cariOperatorPrisma({ items: [{ ok: 1 }, { products: { updateMany: { where: {}, data: {} } } }] })).toBe('updateMany');
    });

    it('webhook pihak luar & GET tidak diperiksa', () => {
        const body = { entry: [{ changes: [{ value: { update: {} } }] }] };
        expect(jalankan({ method: 'POST', path: '/whatsapp/webhook', body }).lanjut).toBe(true);
        expect(jalankan({ method: 'GET', path: '/batches', body }).lanjut).toBe(true);
    });
});
