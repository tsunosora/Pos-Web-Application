import { Parser } from 'expr-eval';

// Parser dibatasi: aktifkan hanya operator aritmatika + fungsi whitelist.
// expr-eval TIDAK mengeksekusi kode host (aman dari injeksi), tapi kita
// tetap batasi permukaan agar rumus config predictable.
const parser = new Parser({
  operators: {
    add: true,
    subtract: true,
    multiply: true,
    divide: true,
    remainder: true,
    power: true,
    factorial: false,
    logical: false,
    comparison: false,
    conditional: false,
    concatenate: false,
    in: false,
    assignment: false,
  },
});

// Defense-in-depth: pangkas built-in expr-eval ke whitelist saja.
// Penting: buang `random` (non-deterministik → harga tak reproducible) & fungsi
// tak relevan (map/fold/filter/if/trig/dll). Fungsi/op di luar whitelist yang
// dipakai rumus akan dianggap variabel tak dikenal → throw saat evaluate.
const ALLOWED_UNARY = new Set(['abs', 'ceil', 'floor', 'round', '-', '+']);
const ALLOWED_FUNCS = new Set(['min', 'max']);
for (const k of Object.keys((parser as any).unaryOps)) {
  if (!ALLOWED_UNARY.has(k)) delete (parser as any).unaryOps[k];
}
for (const k of Object.keys((parser as any).functions)) {
  if (!ALLOWED_FUNCS.has(k)) delete (parser as any).functions[k];
}

/**
 * Evaluasi rumus qty komponen dengan aman.
 * @param formula mis. "ceil(halaman / ukuran.pagesPerA3)"
 * @param scope   variabel (nilai opsi + metadata choice, boleh objek bertingkat)
 * @returns number >= 0 (finite). Pemanggil yang bertanggung jawab me-round/clamp min-1.
 */
export function evalQtyFormula(formula: string, scope: Record<string, any>): number {
  const expr = parser.parse(String(formula));
  const val = expr.evaluate(scope);
  if (typeof val !== 'number' || !Number.isFinite(val)) {
    throw new Error(`Rumus qty menghasilkan nilai tidak valid: ${formula}`);
  }
  return Math.max(0, val);
}

/**
 * Render "Buku {ukuran} {isi.name}" → substitusi dari ctx (dukung path bertitik).
 * Placeholder yang tak terpetakan diganti string kosong (tanpa error).
 */
export function renderNameTemplate(template: string, ctx: Record<string, any>): string {
  return String(template).replace(/\{([^}]+)\}/g, (_m, path: string) => {
    const val = path
      .trim()
      .split('.')
      .reduce<any>((acc, k) => (acc == null ? undefined : acc[k]), ctx);
    return val == null ? '' : String(val);
  });
}

export interface CompositeBreakdownRow {
  variantFrom: string;
  variantId: number;
  name: string;
  qty: number;
  price: number; // harga satuan variant
  hpp: number; // hpp satuan variant
  lineTotal: number; // qty × price
  lineHpp: number; // qty × hpp
}

export interface CompositeQuote {
  name: string;
  price: number;
  hpp: number;
  breakdown: CompositeBreakdownRow[];
}

type VariantInfo = { name: string; price: number; hpp: number };

/**
 * Fungsi inti (murni): hitung harga & HPP produk COMPOSITE dari config + opsi terpilih.
 * @param config          isi Product.compositeConfig ({ options, components, nameTemplate })
 * @param selectedOptions { [optionKey]: value } — variantRef → variantId, select → choice.value, number → number
 * @param variantMap      peta variantId → { name, price, hpp } (di-resolve pemanggil dari DB)
 */
export function resolveCompositeQuote(
  config: any,
  selectedOptions: Record<string, any>,
  variantMap: Record<number, VariantInfo>,
): CompositeQuote {
  if (!config || !Array.isArray(config.components)) {
    throw new Error('compositeConfig tidak valid (components kosong)');
  }

  // Bangun scope untuk rumus qty + konteks untuk nameTemplate.
  const scope: Record<string, any> = {};
  const nameCtx: Record<string, any> = {};
  for (const opt of config.options ?? []) {
    const val = selectedOptions[opt.key];
    if (opt.type === 'select') {
      const choice = (opt.choices ?? []).find((c: any) => c.value === val);
      if (!choice && val != null) throw new Error(`Pilihan tidak valid untuk ${opt.key}: ${val}`);
      scope[opt.key] = choice ? { ...choice } : val; // objek → dukung ukuran.pagesPerA3
      nameCtx[opt.key] = choice ? choice.value : val;
    } else if (opt.type === 'number') {
      scope[opt.key] = Number(val);
      nameCtx[opt.key] = Number(val);
    } else if (opt.type === 'variantRef') {
      scope[opt.key] = val; // variantId
      const info = val != null ? variantMap[Number(val)] : undefined;
      nameCtx[opt.key] = info ? { name: info.name } : {};
    }
  }

  const breakdown: CompositeBreakdownRow[] = [];
  let price = 0;
  let hpp = 0;
  for (const comp of config.components) {
    const variantId = Number(selectedOptions[comp.variantFrom]);
    if (!variantId) throw new Error(`Opsi komponen wajib belum dipilih: ${comp.variantFrom}`);
    const info = variantMap[variantId];
    if (!info) throw new Error(`Variant komponen tidak ditemukan: ${variantId}`);

    let qty: number;
    if (comp.qtyFormula) {
      qty = Math.max(1, Math.round(evalQtyFormula(comp.qtyFormula, scope)));
    } else {
      qty = Math.max(1, Math.round(Number(comp.qty ?? 1)));
    }
    const lineTotal = qty * info.price;
    const lineHpp = qty * info.hpp;
    price += lineTotal;
    hpp += lineHpp;
    breakdown.push({
      variantFrom: comp.variantFrom,
      variantId,
      name: info.name,
      qty,
      price: info.price,
      hpp: info.hpp,
      lineTotal,
      lineHpp,
    });
  }

  const name = renderNameTemplate(config.nameTemplate ?? '', nameCtx);
  return { name, price, hpp, breakdown };
}
