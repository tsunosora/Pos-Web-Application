/**
 * "Pengguna: 4 dari 5" — menyusun baris pemakaian vs batas untuk Pengaturan → Langganan.
 *
 * MURNI: tanpa React, tanpa import, sama seperti `aturan-menu.ts`, supaya bisa diuji dengan
 * `node --test` tanpa memasang apa pun.
 *
 * Tiga aturan yang menentukan bentuk berkas ini:
 *
 * 1. INI CUMA KETERANGAN, bukan penjagaan. Yang benar-benar menolak penambahan adalah
 *    `BatasService` di backend. Jangan pernah dipakai untuk mematikan tombol "Tambah pengguna":
 *    kalau `/saya/fitur` gagal, tombolnya jadi mati tanpa alasan — dan menampilkan galat 403
 *    yang jujur dari backend jauh lebih baik daripada tombol yang diam.
 *
 * 2. JANGAN MENAKUT-NAKUTI. Angkanya ditulis apa adanya. Penanda cuma muncul kalau tinggal satu
 *    slot lagi atau sudah penuh, dan kalimatnya tidak pernah menuduh. Klien yang sudah lewat
 *    batas diberi tahu terang-terangan bahwa datanya tidak diapa-apakan — itu pertanyaan
 *    pertama yang muncul di kepalanya begitu dia melihat "8 dari 5".
 *
 * 3. TANPA BATAS = TIDAK DITAMPILKAN. Baris "Pengguna: 12 dari tanpa batas" cuma bising. Batas
 *    `null` (termasuk kode yang tidak ada di kunci) disembunyikan; `0` TIDAK — nol berarti jenis
 *    itu memang tidak termasuk paket, dan itu justru perlu kelihatan.
 *
 * Kode & namanya mengikuti `backend/src/lisensi/aturan-batas.ts` (dan kosakata
 * `data/paket.json` di repo qendali). Kalau menambah jenis batas di backend, tambahkan di sini
 * juga — yang tidak ada di tabel ini tidak akan pernah tampil.
 */

export interface KeadaanUntukPemakaian {
    ditegakkan: boolean;
    paket?: string | null;
    batas?: Record<string, number | null> | null;
    pemakaian?: Record<string, number> | null;
}

/** Nada baris — penentu warna, bukan penentu izin. */
export type NadaPemakaian = 'biasa' | 'dekat' | 'penuh';

export interface BarisPemakaian {
    kode: string;
    /** Label: "Pengguna", "Cabang". */
    nama: string;
    pemakaian: number;
    batas: number;
    /** Siap tempel: "4 dari 5 pengguna". */
    teks: string;
    nada: NadaPemakaian;
    /** Kalimat tenang di bawah angkanya, atau null kalau tidak perlu bicara. */
    catatan: string | null;
}

const LABEL: Readonly<Record<string, { nama: string; satuan: string }>> = {
    'limit.users': { nama: 'Pengguna', satuan: 'pengguna' },
    'limit.branches': { nama: 'Cabang', satuan: 'cabang' },
};

/** Urutan tampil = urutan di tabel di atas, supaya tidak berpindah-pindah tiap render. */
const URUTAN = Object.keys(LABEL);

export function barisPemakaian(keadaan: KeadaanUntukPemakaian | null | undefined): BarisPemakaian[] {
    // Penegakan mati / data belum ada → tidak ada batas yang berlaku, jadi tidak ada yang
    // perlu ditampilkan. Sama sikapnya dengan menu: gagal ambil = jangan bicara soal batas.
    if (!keadaan || !keadaan.ditegakkan) return [];

    const batas = keadaan.batas ?? {};
    const pakai = keadaan.pemakaian ?? {};
    const baris: BarisPemakaian[] = [];

    for (const kode of URUTAN) {
        const nilai = batas[kode];
        // `null`/tak ada = tanpa batas → sembunyikan. `0` tetap tampil (aturan 3).
        if (typeof nilai !== 'number' || !Number.isFinite(nilai)) continue;
        // Backend belum mengirim hitungannya (mis. querynya gagal) → lebih baik tidak menebak.
        const terpakai = pakai[kode];
        if (typeof terpakai !== 'number' || !Number.isFinite(terpakai)) continue;

        const label = LABEL[kode];
        const sisa = nilai - terpakai;
        const nada: NadaPemakaian = sisa <= 0 ? 'penuh' : sisa === 1 ? 'dekat' : 'biasa';

        let catatan: string | null = null;
        if (terpakai > nilai) {
            catatan =
                `Lebih dari batas paket. Yang ${terpakai} itu tetap jalan seperti biasa — ` +
                `yang belum bisa cuma menambah ${label.satuan} baru.`;
        } else if (nada === 'penuh') {
            catatan = nilai === 0
                ? `Tidak termasuk paket ini. Naikkan paket kalau butuh ${label.satuan}.`
                : `Sudah penuh. Menambah ${label.satuan} baru ditolak sampai paketnya dinaikkan.`;
        } else if (nada === 'dekat') {
            catatan = `Tinggal 1 ${label.satuan} lagi.`;
        }

        baris.push({
            kode,
            nama: label.nama,
            pemakaian: terpakai,
            batas: nilai,
            teks: `${terpakai} dari ${nilai} ${label.satuan}`,
            nada,
            catatan,
        });
    }

    return baris;
}

/** Ada yang perlu ditampilkan? Dipakai komponen supaya tidak merender bagian kosong. */
export const adaPemakaian = (keadaan: KeadaanUntukPemakaian | null | undefined): boolean =>
    barisPemakaian(keadaan).length > 0;
