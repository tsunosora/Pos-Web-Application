import {
  buildCompositeClickBatch,
  type VariantClickCfg,
} from './composite-click.util';

// Tarif nyata di DB: #1 A3+ WARNA Rp 1.000 (1 sisi), #5 A3+ 2MUKA WARNA Rp 2.000.
const A3_1SISI = { id: 1, isActive: true, pricePerClick: 1000 };
const A3_2SISI = { id: 5, isActive: true, pricePerClick: 2000 };

const isi: VariantClickCfg = { id: 106, clicksPerUnit: 1, clickRate: A3_2SISI };
const cover: VariantClickCfg = {
  id: 105,
  clicksPerUnit: 1,
  clickRate: A3_1SISI,
};
const jilid: VariantClickCfg = {
  id: 900,
  clicksPerUnit: null,
  clickRate: null,
  product: null,
};

// Buku A4 26 halaman → isi = ceil(26/4) = 7 lembar (2 sisi), cover 1 lembar, jilid 1×.
const breakdownBuku = [
  { variantId: 106, qty: 7, name: 'Cetak Art Paper 100gr — 2 SISI' },
  { variantId: 105, qty: 1, name: 'Cetak Art Paper 100gr — 1 SISI' },
  { variantId: 900, qty: 1, name: 'Jilid Buku (Finishing)' },
];

describe('buildCompositeClickBatch — klik untuk produk komposit', () => {
  it('menghitung klik isi & cover untuk 1 buku', () => {
    const out = buildCompositeClickBatch(breakdownBuku, [isi, cover, jilid], 1);
    expect(out).toEqual([
      {
        rateId: 5,
        pricePerClick: 2000,
        clicks: 7,
        label: 'Cetak Art Paper 100gr — 2 SISI ×7',
      },
      {
        rateId: 1,
        pricePerClick: 1000,
        clicks: 1,
        label: 'Cetak Art Paper 100gr — 1 SISI ×1',
      },
    ]);
  });

  it('dikalikan jumlah buku di baris nota', () => {
    const out = buildCompositeClickBatch(
      breakdownBuku,
      [isi, cover, jilid],
      10,
    );
    expect(out.find((e) => e.rateId === 5)?.clicks).toBe(70);
    expect(out.find((e) => e.rateId === 1)?.clicks).toBe(10);
  });

  it('komponen tanpa tarif klik (jilid/finishing) diabaikan', () => {
    const out = buildCompositeClickBatch(breakdownBuku, [isi, cover, jilid], 1);
    expect(out).toHaveLength(2);
    expect(out.some((e) => e.label?.includes('Jilid'))).toBe(false);
  });

  it('komponen bertarif sama digabung jadi satu catatan klik', () => {
    const sama = [
      { variantId: 105, qty: 2, name: 'Cover depan' },
      { variantId: 105, qty: 3, name: 'Cover belakang' },
    ];
    const out = buildCompositeClickBatch(sama, [cover], 2);
    expect(out).toEqual([
      {
        rateId: 1,
        pricePerClick: 1000,
        clicks: 10,
        label: 'Cover depan ×4 + Cover belakang ×6',
      },
    ]);
  });

  it('tarif nonaktif tidak dipakai; cadangan ke tarif produk', () => {
    const varianTarifMati: VariantClickCfg = {
      id: 106,
      clicksPerUnit: 1,
      clickRate: { id: 5, isActive: false, pricePerClick: 2000 },
      product: { clicksPerUnit: 1, clickRate: A3_1SISI },
    };
    const out = buildCompositeClickBatch(
      [{ variantId: 106, qty: 3, name: 'Isi' }],
      [varianTarifMati],
      1,
    );
    expect(out).toEqual([
      { rateId: 1, pricePerClick: 1000, clicks: 3, label: 'Isi ×3' },
    ]);
  });

  it('klik/unit selain 1 ikut dihitung (mis. 1 unit = 2 lembar)', () => {
    const duaLembar: VariantClickCfg = {
      id: 77,
      clicksPerUnit: 2,
      clickRate: A3_1SISI,
    };
    const out = buildCompositeClickBatch(
      [{ variantId: 77, qty: 3, name: 'Sisipan' }],
      [duaLembar],
      2,
    );
    expect(out[0].clicks).toBe(12); // 3 × 2 × 2
  });

  it('data kosong / qty nol tidak menghasilkan klik', () => {
    expect(buildCompositeClickBatch(null, [isi], 5)).toEqual([]);
    expect(buildCompositeClickBatch([], [isi], 5)).toEqual([]);
    expect(
      buildCompositeClickBatch(
        [{ variantId: 106, qty: 0, name: 'Isi' }],
        [isi],
        5,
      ),
    ).toEqual([]);
    expect(
      buildCompositeClickBatch(
        [{ variantId: 999, qty: 3, name: 'Tak dikenal' }],
        [isi],
        1,
      ),
    ).toEqual([]);
  });
});
