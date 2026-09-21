/**
 * Pengaman formula injection untuk ekspor spreadsheet (T-25): teks yang diawali
 * = + - @ bisa dijalankan Excel sebagai rumus (mis. nama pelanggan
 * `=HYPERLINK("http://…")`). Diberi awalan ' supaya tetap teks. Nomor HP "+62…",
 * angka bertanda, dan tanda "-" kosong dibiarkan. Aturannya sama dengan csvCell
 * di lead-export.ts.
 */
export function safeCellText(v: string): string {
    if (/^[=@]/.test(v) || (/^[+-]/.test(v) && !/^[+-][\d\s().,-]*$/.test(v))) return `'${v}`;
    return v;
}

const aman = (v: unknown) => (typeof v === 'string' ? safeCellText(v) : v);

/** Baris objek (json_to_sheet) → nilai teks diamankan. */
export function safeRows<T extends Record<string, unknown>>(rows: T[]): T[] {
    return rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, aman(v)])) as T);
}

/** Array of arrays (aoa_to_sheet) → nilai teks diamankan. */
export function safeAoa(aoa: unknown[][]): unknown[][] {
    return aoa.map((row) => row.map(aman));
}
