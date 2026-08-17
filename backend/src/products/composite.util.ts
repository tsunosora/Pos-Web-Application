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
