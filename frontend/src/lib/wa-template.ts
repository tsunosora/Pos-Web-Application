// Utilitas parameter template WhatsApp (Meta Cloud API).
// Template bisa punya variabel {{1}}, {{2}}, ... di HEADER (teks) dan BODY.
// Saat mengirim, parameter WAJIB diisi sesuai jumlahnya, kalau tidak Meta
// menolak dengan error #132000 "Number of parameters does not match".

/** Ambil indeks variabel unik ({{1}},{{2}}, …) dari sebuah teks, terurut. */
export function extractVarIndices(text?: string | null): number[] {
    if (!text) return [];
    const set = new Set<number>();
    for (const m of text.matchAll(/\{\{\s*(\d+)\s*\}\}/g)) set.add(Number(m[1]));
    return [...set].sort((a, b) => a - b);
}

/** Jumlah variabel di body (dipakai untuk validasi cepat). */
export function bodyVarCount(bodyText?: string | null): number {
    return extractVarIndices(bodyText).length;
}

/** Bentuk array `components` Meta dari nilai variabel header & body. */
export function buildTemplateComponents(
    tpl: { bodyText: string; headerText?: string | null },
    bodyVals: string[],
    headerVals: string[] = [],
): unknown[] {
    const components: unknown[] = [];
    const headerIdx = extractVarIndices(tpl.headerText);
    if (headerIdx.length) {
        components.push({
            type: 'header',
            parameters: headerIdx.map((_, i) => ({ type: 'text', text: headerVals[i] ?? '' })),
        });
    }
    const bodyIdx = extractVarIndices(tpl.bodyText);
    if (bodyIdx.length) {
        components.push({
            type: 'body',
            parameters: bodyIdx.map((_, i) => ({ type: 'text', text: bodyVals[i] ?? '' })),
        });
    }
    return components;
}

/** Substitusi nilai variabel ke body → teks pratinjau untuk disimpan/ditampilkan. */
export function fillTemplatePreview(bodyText: string, bodyVals: string[]): string {
    const idx = extractVarIndices(bodyText);
    let out = bodyText;
    idx.forEach((n, i) => {
        const val = (bodyVals[i] ?? '').trim() || `{{${n}}}`;
        out = out.replace(new RegExp(`\\{\\{\\s*${n}\\s*\\}\\}`, 'g'), val);
    });
    return out;
}

/** Label ramah untuk variabel ke-i (dari variableLabels template bila ada). */
export function varLabel(labels: unknown, i: number, fallback = `Isian ${i + 1}`): string {
    if (Array.isArray(labels) && typeof labels[i] === 'string' && labels[i].trim()) return labels[i];
    return fallback;
}
