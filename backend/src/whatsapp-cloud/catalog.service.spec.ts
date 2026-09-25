import { absolutePublicUrl, buildPosCatalogPlan, posRetailerId } from './catalog.service';

describe('buildPosCatalogPlan — produk POS → item katalog WhatsApp', () => {
    const BASE = 'https://api.contoh-toko.com';
    const brosur = {
        name: 'Paket Brosur 1RIM 1MUKA AP 120gsm 20 x 10cm',
        description: 'Brosur full color 500 lembar',
        imageUrl: '/uploads/a.png',
        imageUrls: '["/uploads/a.png","/uploads/b.png"]',
        pricingMode: 'UNIT',
        variants: [{ id: 368, variantName: 'Standar', price: '260000.00' }],
    };

    it('1 varian: nama produk, harga minor unit, gambar absolut, galeri tanpa gambar utama', () => {
        const [p] = buildPosCatalogPlan(brosur, BASE, {});
        expect(p.action).toBe('create');
        expect(p.payload).toMatchObject({
            name: 'Paket Brosur 1RIM 1MUKA AP 120gsm 20 x 10cm',
            description: 'Brosur full color 500 lembar',
            price: 26000000,
            currency: 'IDR',
            image_url: 'https://api.contoh-toko.com/uploads/a.png',
            additional_image_urls: ['https://api.contoh-toko.com/uploads/b.png'],
            availability: 'in stock',
        });
    });

    it('varian yang sudah ada di katalog → diperbarui, bukan dibuat dobel', () => {
        const [p] = buildPosCatalogPlan(brosur, BASE, { 368: { catalogProductId: '28413233054982930' } });
        expect(p.action).toBe('update');
        expect(p.catalogProductId).toBe('28413233054982930');
    });

    it('multi varian: nama + varian, gambar varian diutamakan, bisa pilih sebagian varian', () => {
        const stiker = {
            name: 'Cetak Stiker Vinyl Glossy', description: null, imageUrl: '/uploads/s.png', imageUrls: null, pricingMode: 'UNIT',
            variants: [
                { id: 1, variantName: '1 SISI', price: 10000, variantImageUrl: '/uploads/v1.png' },
                { id: 2, variantName: 'KissCut', price: 15000 },
            ],
        };
        const plan = buildPosCatalogPlan(stiker, BASE, {}, [2]);
        expect(plan).toHaveLength(1);
        expect(plan[0].payload?.name).toBe('Cetak Stiker Vinyl Glossy — KissCut');
        expect(plan[0].payload?.description).toBe('Cetak Stiker Vinyl Glossy — KissCut'); // deskripsi kosong → nama
        expect(buildPosCatalogPlan(stiker, BASE, {}, [1])[0].payload?.image_url).toBe('https://api.contoh-toko.com/uploads/v1.png');
    });

    it('produk tanpa gambar dilewati dengan pesan jelas', () => {
        const [p] = buildPosCatalogPlan({ ...brosur, imageUrl: null, imageUrls: '[]' }, BASE, {});
        expect(p.action).toBe('skip');
        expect(p.error).toMatch(/belum punya gambar/);
    });

    it('produk luas: deskripsi diberi keterangan harga per m²', () => {
        const [p] = buildPosCatalogPlan({ ...brosur, name: 'Cetak Banner F300', description: 'Spanduk flexi', pricingMode: 'AREA_BASED', areaUnit: 'M2' }, BASE, {});
        expect(p.payload?.description).toBe('Spanduk flexi\n\nHarga per m².');
    });

    it('URL absolut & retailer_id stabil', () => {
        expect(absolutePublicUrl('uploads/x.png', 'https://api.contoh-toko.com/')).toBe('https://api.contoh-toko.com/uploads/x.png');
        expect(absolutePublicUrl('https://cdn.contoh.com/x.png', BASE)).toBe('https://cdn.contoh.com/x.png');
        expect(absolutePublicUrl('  ', BASE)).toBeNull();
        expect(posRetailerId(368)).toBe('pos-v368');
    });
});
