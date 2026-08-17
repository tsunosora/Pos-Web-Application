import { evalQtyFormula, renderNameTemplate } from './composite.util';

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
