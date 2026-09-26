/**
 * Halaman Pengaturan → Langganan.
 *
 * Semua panggilan di sini menuju BACKEND POS SENDIRI (`/langganan/*`), bukan qendali.com.
 * Alasannya satu dan tidak bisa ditawar: yang boleh mengubah langganan cuma pemegang token
 * instalasi, dan token itu tidak pernah boleh sampai ke browser. Backend yang menyimpannya di
 * env dan menempelkannya ke permintaan keluar. Kalau suatu hari ada yang tergoda memanggil
 * qendali.com langsung dari sini supaya "lebih singkat", token itu harus ikut ke browser —
 * dan saat itu juga siapa pun yang membuka DevTools bisa mengganti paket orang.
 *
 * Angka dan kalimat akibat perubahan (`rincian`, `jumlah`, `berlakuPada`, `alasan`) datang
 * matang dari penerbit. JANGAN menghitung prorata di sini: kalau dua sisi menghitung sendiri,
 * suatu hari keduanya beda dan yang dipercaya pemilik toko adalah yang tampil di layar.
 */
import api from './client';

// ── Bentuk data (cerminan `docs/lisensi.md` → "API untuk aplikasi") ────────────────────

export interface PaketRingkas {
    kode: string;
    nama?: string;
    harga?: number;
}

export interface LanggananInti {
    status: string;
    paket: PaketRingkas;
    hargaBulanan: number;
    hargaKhusus: boolean;
    mulai: string | null;
    dibayarSampai: string | null;
}

/** Satu pilihan paket, lengkap dengan akibatnya kalau dipilih. */
export interface PilihanPaket {
    kode: string;
    nama: string;
    harga: number;
    sorot: string[];
    boleh: boolean;
    alasan: string | null;
    arah: 'naik' | 'turun' | null;
    cara: 'langsung' | 'bayar_selisih' | 'bayar_penuh' | 'akhir_periode' | null;
    jumlah: number;
    berlakuPada: string | null;
    rincian: string[];
    /** Fitur/add-on yang ikut hilang kalau pindah ke paket ini. */
    dilepas: string[];
}

export interface PilihanTambahan {
    kode: string;
    nama: string;
    harga: number | null;
    bentuk: string;
    terpasang: boolean;
    aksi: 'pasang' | 'lepas';
    boleh: boolean;
    alasan: string | null;
    cara: string | null;
    jumlah: number;
    berlakuPada: string | null;
    rincian: string[];
}

export interface PerubahanTertunda {
    id: number;
    jenis: string;
    uraian: string;
    status: string;
    statusTeks: string;
    berlakuPada: string | null;
    jumlah: number;
    rincian: string[];
    tagihan: { id: number; nomor: string; status: string } | null;
}

export interface Tagihan {
    id: number;
    nomor: string;
    periodeMulai: string | null;
    periodeSampai: string | null;
    jumlah: number;
    rincian: string[];
    jatuhTempo: string | null;
    status: string;
}

export interface PetunjukDns {
    jenis: string;
    namaRecord: string;
    domainUtama: string;
    namaLengkap: string;
    tujuan: string;
}

export interface DomainSendiri {
    nama: string;
    status: 'menunggu_dns' | 'menyiapkan' | 'aktif' | string;
    pesan: string | null;
    diperiksaPada: string | null;
    aktifPada: string | null;
    dns: PetunjukDns;
}

export interface Alamat {
    utama: string;
    domainInduk: string;
    /** Paketnya memuat fitur `domain.sendiri`? */
    bolehDomainSendiri: boolean;
    bisaDiatur: boolean;
    domainSendiri: DomainSendiri | null;
}

export interface RingkasanLangganan {
    tersambung: true;
    klien: { kode: string; nama: string };
    produk: string;
    langganan: LanggananInti;
    fitur: string[];
    pilihanPaket: PilihanPaket[];
    tambahan: PilihanTambahan[];
    perubahanTertunda: PerubahanTertunda | null;
    tagihan: Tagihan[];
    alamat: Alamat;
    pembayaran: { rekening: { nama?: string; bank?: string; nomor?: string } | null; catatan: string };
}

/** Instalasi yang tidak dikelola qendali.com — keadaan NORMAL, bukan galat. */
export interface BelumTersambung {
    tersambung: false;
    pesan: string;
}

export type JawabanLangganan = RingkasanLangganan | BelumTersambung;

export interface HasilPerubahan {
    status: 'menunggu_bayar' | 'terjadwal' | 'diterapkan' | 'batal' | string;
    /** Cuma id & nomornya — rincian lengkapnya ada di daftar `tagihan` pada ringkasan. */
    tagihan?: { id: number; nomor: string } | null;
    /** Ringkasan yang sudah diperbarui. Halaman ini mengabaikannya dan memuat ulang saja. */
    langganan?: RingkasanLangganan;
}

// ── Panggilan ──────────────────────────────────────────────────────────────────────────

export const getLangganan = async (): Promise<JawabanLangganan> => (await api.get('/langganan')).data;

export const gantiPaket = async (paket: string): Promise<HasilPerubahan> =>
    (await api.post('/langganan/perubahan', { jenis: 'ganti_paket', paket })).data;

export const pasangTambahan = async (tambahan: string): Promise<HasilPerubahan> =>
    (await api.post('/langganan/perubahan', { jenis: 'pasang_tambahan', tambahan })).data;

export const lepasTambahan = async (tambahan: string): Promise<HasilPerubahan> =>
    (await api.post('/langganan/perubahan', { jenis: 'lepas_tambahan', tambahan })).data;

export const batalkanPerubahan = async (): Promise<unknown> => (await api.delete('/langganan/perubahan')).data;

/**
 * "Saya sudah transfer" — memindahkan tagihan ke `menunggu_verifikasi`, BUKAN lunas.
 * Yang melunaskan cuma Qendali setelah mengecek mutasi bank. Tulisan di layar harus jujur
 * soal itu, kalau tidak orang mengira sudah beres dan kaget saat ditagih lagi.
 */
export const sudahTransfer = async (id: number, catatan: string): Promise<unknown> =>
    (await api.post('/langganan/tagihan', { id, catatan })).data;

export const pasangDomain = async (nama: string): Promise<{ alamat: Alamat }> =>
    (await api.put('/langganan/domain', { nama })).data;

export const periksaDomain = async (): Promise<{ alamat: Alamat; terlaluCepat?: boolean }> =>
    (await api.post('/langganan/domain/periksa')).data;

export const lepasDomain = async (): Promise<{ alamat: Alamat }> => (await api.delete('/langganan/domain')).data;

/**
 * Tarik kunci lisensi terbaru sekarang, tanpa menunggu penyegaran harian 03.37.
 * Dipanggil setelah perubahan yang langsung berlaku, supaya menu barunya muncul hari itu juga.
 * Gagal di sini bukan bencana — besok kuncinya tersegarkan sendiri.
 */
export const segarkanLisensi = async (): Promise<unknown> => (await api.post('/saya/lisensi/segarkan')).data;

// ── Bantuan tampilan ───────────────────────────────────────────────────────────────────

export const rupiah = (n: number): string => 'Rp ' + Math.round(n).toLocaleString('id-ID');

/** "2026-10-06" → "6 Okt 2026". Kosong → "—". */
export function tanggal(iso: string | null | undefined): string {
    if (!iso) return '—';
    const d = new Date(iso.length <= 10 ? iso + 'T00:00:00' : iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Ambil kalimat galat dari backend. Bentuknya `{salah, pesan}` — `pesan` memang ditulis
 * penerbit untuk dibaca pemilik toko, jadi tampilkan apa adanya.
 */
export function pesanGalat(e: unknown): string {
    const data = (e as { response?: { data?: { pesan?: string; message?: string | string[] } } })?.response?.data;
    if (data?.pesan) return data.pesan;
    const m = data?.message;
    if (Array.isArray(m)) return m.join(', ');
    if (typeof m === 'string') return m;
    return 'Gagal menghubungi server. Coba lagi sebentar lagi.';
}
