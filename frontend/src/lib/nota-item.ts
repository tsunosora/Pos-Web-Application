/**
 * Nama & catatan satu baris nota untuk tampilan/cetak.
 * - Item custom (dari lead CRM) tidak punya varian katalog → pakai customName.
 * - Item produk konfigurasi (composite) memakai varian "anchor"; nama deskriptifnya di customName,
 *   dan kolom note berisi JSON rincian pilihan — catatan pelanggan ada di userNote.
 */
type BarisNota = {
    customName?: string | null;
    note?: string | null;
    productVariant?: { name?: string | null; variantName?: string | null; product?: { name?: string | null } | null } | null;
};

export function namaItemNota(item: BarisNota): string {
    const custom = (item.customName || '').trim();
    if (custom) return custom;
    const produk = item.productVariant?.product?.name || 'Item';
    const varian = item.productVariant?.variantName || item.productVariant?.name || '';
    return varian && varian !== produk ? `${produk} — ${varian}` : produk;
}

export function catatanItemNota(note?: string | null): string | null {
    if (!note) return null;
    const s = String(note).trim();
    if (s.startsWith('{')) {
        try {
            const j = JSON.parse(s);
            if (j && j.kind === 'composite') return j.userNote ? String(j.userNote) : null;
        } catch { /* bukan JSON → catatan biasa */ }
    }
    return s;
}
