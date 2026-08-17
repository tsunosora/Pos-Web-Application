import { evalQtyFormula, renderNameTemplate, resolveCompositeQuote } from './composite.util';

describe('evalQtyFormula', () => {
  it('menghitung ceil(halaman / ukuran.pagesPerA3)', () => {
    const scope = { halaman: 33, ukuran: { pagesPerA3: 16 } };
    expect(evalQtyFormula('ceil(halaman / ukuran.pagesPerA3)', scope)).toBe(3);
  });

  it('mengembalikan angka literal tanpa variabel', () => {
    expect(evalQtyFormula('1', {})).toBe(1);
  });

  it('menolak ekspresi tak dikenal / injeksi (throw)', () => {
    expect(() => evalQtyFormula('process.exit(1)', {})).toThrow();
  });

  it('hasil di-clamp minimal 0 dan number valid', () => {
    expect(evalQtyFormula('max(1, halaman)', { halaman: 5 })).toBe(5);
  });

  it('menolak fungsi non-deterministik (random) demi harga reproducible', () => {
    expect(() => evalQtyFormula('random()', {})).toThrow();
  });
});

describe('renderNameTemplate', () => {
  it('mengisi placeholder {key} dan {ref.name}', () => {
    const tpl = 'Buku {ukuran} {halaman}hal — {isi.name} + {cover.name}';
    const ctx = {
      ukuran: 'A5',
      halaman: 33,
      isi: { name: 'Art Paper 150gr 2 SISI' },
      cover: { name: 'Art Carton 260gr 1 SISI' },
    };
    expect(renderNameTemplate(tpl, ctx)).toBe(
      'Buku A5 33hal — Art Paper 150gr 2 SISI + Art Carton 260gr 1 SISI',
    );
  });

  it('placeholder tak dikenal jadi string kosong (tidak error)', () => {
    expect(renderNameTemplate('X {tidakada}', {})).toBe('X ');
  });
});

describe('resolveCompositeQuote', () => {
  const CONFIG = {
    options: [
      { key: 'ukuran', label: 'Ukuran', type: 'select', choices: [
        { value: 'A5', label: 'A5', pagesPerA3: 8 },
      ]},
      { key: 'halaman', label: 'Jumlah Halaman', type: 'number', min: 1 },
      { key: 'isi', label: 'Bahan Isi', type: 'variantRef', filter: {} },
      { key: 'cover', label: 'Bahan Cover', type: 'variantRef', filter: {} },
      { key: 'finishing', label: 'Finishing', type: 'variantRef', filter: {} },
    ],
    components: [
      { variantFrom: 'isi', qtyFormula: 'ceil(halaman / ukuran.pagesPerA3)' },
      { variantFrom: 'cover', qty: 1 },
      { variantFrom: 'finishing', qty: 1 },
    ],
    nameTemplate: 'Buku {ukuran} {halaman}hal — {isi.name} + {cover.name} + {finishing.name}',
  };

  const VMAP = {
    11: { name: 'Isi 2 SISI', price: 1000, hpp: 400 },
    22: { name: 'Cover 1 SISI', price: 3000, hpp: 1200 },
    33: { name: 'Jilid Spiral', price: 5000, hpp: 2000 },
  };

  const selected = { ukuran: 'A5', halaman: 16, isi: 11, cover: 22, finishing: 33 };

  it('menghitung price = Σ(qty × variant.price)', () => {
    // isi qty = ceil(16/8)=2 → 2*1000=2000; cover 1*3000=3000; finishing 1*5000=5000
    expect(resolveCompositeQuote(CONFIG, selected, VMAP).price).toBe(10000);
  });

  it('menghitung hpp = Σ(qty × variant.hpp)', () => {
    expect(resolveCompositeQuote(CONFIG, selected, VMAP).hpp).toBe(2 * 400 + 1200 + 2000); // 3800
  });

  it('name dari template terisi', () => {
    expect(resolveCompositeQuote(CONFIG, selected, VMAP).name).toBe(
      'Buku A5 16hal — Isi 2 SISI + Cover 1 SISI + Jilid Spiral',
    );
  });

  it('breakdown berisi per komponen {variantId, qty, price, hpp}', () => {
    const q = resolveCompositeQuote(CONFIG, selected, VMAP);
    expect(q.breakdown).toHaveLength(3);
    expect(q.breakdown[0]).toMatchObject({ variantId: 11, qty: 2, price: 1000, hpp: 400 });
  });

  it('throw kalau variantRef wajib tidak dipilih', () => {
    const bad = { ...selected, isi: undefined };
    expect(() => resolveCompositeQuote(CONFIG, bad as any, VMAP)).toThrow();
  });

  it('throw kalau variantId tidak ada di variantMap', () => {
    const bad = { ...selected, isi: 999 };
    expect(() => resolveCompositeQuote(CONFIG, bad, VMAP)).toThrow();
  });
});
