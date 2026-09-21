/**
 * Rentang tanggal dari filter halaman ('YYYY-MM-DD') → awal/akhir hari WIB (zona server).
 * `new Date('2026-09-21')` = tengah malam UTC = 07:00 WIB, dan `…T23:59:59.999Z` = 06:59 WIB
 * keesokan harinya — dulu rentang laporan bergeser 7 jam: nota mundur-tanggal (jam 00:00 WIB)
 * jatuh ke hari sebelumnya atau hilang dari halaman Kas.
 * Bentuk lain (ISO lengkap dengan jam) dipakai apa adanya.
 */
const HANYA_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;

export function awalHari(s: string): Date {
    return HANYA_TANGGAL.test(s) ? new Date(`${s}T00:00:00`) : new Date(s);
}

export function akhirHari(s: string): Date {
    return HANYA_TANGGAL.test(s) ? new Date(`${s}T23:59:59.999`) : new Date(s);
}
