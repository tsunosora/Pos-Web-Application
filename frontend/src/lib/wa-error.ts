/**
 * Penjelasan singkat kode gagal kirim WhatsApp Cloud API untuk agen inbox.
 * Kode & artinya mengikuti dokumentasi error Cloud API Meta; yang tidak dikenal
 * jatuh ke pesan mentah dari Meta supaya tetap ada petunjuk.
 */
const HINTS: Record<string, string> = {
    "131042": "Masalah pembayaran akun WhatsApp Business. Periksa metode bayar di WhatsApp Manager — selama belum beres, pesan template tidak bisa terkirim.",
    "131047": "Sudah lewat 24 jam sejak pelanggan terakhir membalas. Kirim pesan template.",
    "131026": "Nomor tidak bisa menerima pesan (tidak terdaftar WhatsApp atau aplikasinya terlalu lama).",
    "131049": "Ditahan Meta: pelanggan ini sudah menerima terlalu banyak pesan pemasaran.",
    "131056": "Terlalu banyak pesan ke nomor yang sama dalam waktu singkat. Coba lagi sebentar lagi.",
    "131031": "Akun WhatsApp Business sedang dikunci Meta.",
    "132000": "Jumlah isian template tidak cocok dengan template yang disetujui.",
    "132001": "Template tidak ditemukan (nama atau bahasa berbeda).",
    "132005": "Teks template terlalu panjang setelah diisi.",
    "132012": "Format isian template tidak sesuai.",
    "132015": "Template sedang dijeda Meta.",
    "132016": "Template dinonaktifkan Meta.",
};

export function waErrorHint(code?: string | null, message?: string | null): string {
    if (code && HINTS[code]) return HINTS[code];
    if (message) return message;
    return "Pengiriman ditolak WhatsApp.";
}
