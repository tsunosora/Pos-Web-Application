/**
 * Normalisasi nomor HP Indonesia ke format kanonik WhatsApp: 62 tanpa '+' / '0'.
 * Contoh: '0812-3456-7890' → '6281234567890', '+62 812...' → '62812...'.
 * Dipakai untuk: penyimpanan seragam, dedup, dan link wa.me/<nomor>.
 *
 * @returns nomor 62xxxx, atau null kalau input kosong/tak valid.
 */
export function toWaPhone(raw?: string | null): string | null {
    if (raw == null) return null;
    let s = String(raw).replace(/\D/g, '');
    if (!s) return null;
    if (s.startsWith('62')) {
        // sudah 62 (mungkin '620xxx' dari salah input → buang 0 setelah 62)
        if (s[2] === '0') s = '62' + s.slice(3);
    } else if (s.startsWith('0')) {
        s = '62' + s.slice(1);
    } else if (s.startsWith('8')) {
        s = '62' + s; // 8xxx → 628xxx (umum saat orang menulis tanpa 0)
    } else {
        s = '62' + s; // fallback: anggap nomor lokal tanpa awalan
    }
    // Validasi panjang wajar nomor Indonesia (62 + 8–13 digit)
    if (s.length < 9 || s.length > 16) return null;
    return s;
}

/**
 * Kunci dedup nomor — sama dengan toWaPhone tapi return '' kalau invalid,
 * supaya aman dipakai sebagai key Map / perbandingan kesamaan.
 */
export function phoneKey(raw?: string | null): string {
    return toWaPhone(raw) ?? '';
}

/**
 * Kunci pencocokan ke Lead.phoneNormalized: konvensi TANPA prefix '62'
 * (mis. '81234567890'). Dipakai modul WhatsApp CRM agar waId dari Meta ('62…')
 * bisa dicocokkan ke Lead/Customer yang menyimpan nomor tanpa 62.
 * @returns '81xxx' atau null kalau input tak valid.
 */
export function toLeadKey(raw?: string | null): string | null {
    const wa = toWaPhone(raw);
    return wa ? wa.replace(/^62/, '') : null;
}

/** Apakah dua nomor identik secara kanonik (untuk dedup). */
export function samePhone(a?: string | null, b?: string | null): boolean {
    const ka = phoneKey(a);
    return ka !== '' && ka === phoneKey(b);
}
