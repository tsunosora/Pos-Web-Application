import { BadRequestException } from '@nestjs/common';

/**
 * Validasi angka masukan nota (T-09, T-10, T-11, T-12, T-28). Dulu diskon/qty/DP
 * negatif atau berlebihan diterima dan menghasilkan nota bernilai minus yang ikut
 * masuk omzet, kas, dan laporan.
 */
const angka = (v: unknown) => (v == null || v === '' ? null : Number(v));

function wajibAngka(nama: string, v: unknown, { min = 0, bulat = false, lebihDari = false } = {}) {
    const n = angka(v);
    if (n == null) return;
    if (!Number.isFinite(n)) throw new BadRequestException(`${nama} harus berupa angka.`);
    if (lebihDari ? n <= min : n < min) throw new BadRequestException(`${nama} tidak boleh ${lebihDari ? `≤ ${min}` : 'negatif'} (dikirim: ${n}).`);
    if (bulat && !Number.isInteger(n)) throw new BadRequestException(`${nama} harus bilangan bulat (dikirim: ${n}).`);
}

export function assertValidTransactionInput(data: {
    items?: { quantity?: unknown; widthCm?: unknown; heightCm?: unknown; pcs?: unknown; customPrice?: unknown; subPrice?: unknown }[];
    discount?: unknown; shippingCost?: unknown; downPayment?: unknown; marketplaceFee?: unknown;
    marketplaceFeeItems?: { amount?: unknown }[];
}): void {
    if (!Array.isArray(data.items) || data.items.length === 0) throw new BadRequestException('Nota harus berisi minimal satu item.');
    // Pajak & total selalu dihitung server. Dulu kiriman taxRate: 500 diterima lalu diabaikan
    // diam-diam, sehingga integrasi luar mengira pajaknya ikut diatur (T-30).
    for (const k of ['taxRate', 'tax', 'grandTotal', 'totalAmount']) {
        if ((data as Record<string, unknown>)[k] !== undefined) {
            throw new BadRequestException(`Kolom "${k}" tidak diterima — pajak & total dihitung server dari setelan toko dan item nota.`);
        }
    }
    data.items.forEach((it, i) => {
        const ke = `Item ke-${i + 1}:`;
        const q = angka(it.quantity);
        if (q != null && (!Number.isInteger(q) || q < 1)) throw new BadRequestException(`${ke} jumlah minimal 1 dan bilangan bulat (dikirim: ${q}).`);
        wajibAngka(`${ke} lebar`, it.widthCm, { lebihDari: true });
        wajibAngka(`${ke} tinggi`, it.heightCm, { lebihDari: true });
        wajibAngka(`${ke} pcs`, it.pcs, { min: 1 });
        wajibAngka(`${ke} harga`, it.customPrice);
        wajibAngka(`${ke} harga sub`, it.subPrice);
    });
    wajibAngka('Diskon', data.discount);
    wajibAngka('Ongkos kirim', data.shippingCost);
    wajibAngka('DP', data.downPayment);
    wajibAngka('Potongan marketplace', data.marketplaceFee);
    (data.marketplaceFeeItems || []).forEach((f, i) => wajibAngka(`Potongan marketplace ke-${i + 1}`, f?.amount));
}

/** Teks satu baris (nama pelanggan dsb.): tanpa baris baru, spasi dirapikan, dipotong (T-26). */
export function satuBaris(v: unknown, max: number): string | null {
    const s = (typeof v === 'string' ? v : v == null ? '' : typeof v === 'number' ? String(v) : '').replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, max);
    return s || null;
}

/** Validasi kiriman edit nota (jumlah, ukuran, pcs, harga override, diskon). */
export function assertValidEditInput(data: {
    items?: { remove?: boolean; quantity?: unknown; widthCm?: unknown; heightCm?: unknown; pcs?: unknown; priceOverride?: unknown }[];
    discount?: unknown;
}): void {
    (data.items || []).forEach((it, i) => {
        if (it?.remove) return;
        const ke = `Item ke-${i + 1}:`;
        const q = angka(it.quantity);
        if (q != null && (!Number.isInteger(q) || q < 1)) throw new BadRequestException(`${ke} jumlah minimal 1 dan bilangan bulat (dikirim: ${q}).`);
        wajibAngka(`${ke} lebar`, it.widthCm, { lebihDari: true });
        wajibAngka(`${ke} tinggi`, it.heightCm, { lebihDari: true });
        wajibAngka(`${ke} pcs`, it.pcs, { min: 1 });
        wajibAngka(`${ke} harga`, it.priceOverride);
    });
    wajibAngka('Diskon', data.discount);
}
