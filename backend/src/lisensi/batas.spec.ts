/**
 * Tes penegakan batas angka lisensi. Tanpa DB, tanpa jaringan: Prisma & LisensiService
 * dipalsukan, yang diuji cuma keputusannya dan CARA MENGHITUNGNYA.
 *
 * Dua kelompok tes yang jangan pernah dilemahkan:
 *
 * 1. GAGAL-TERBUKA. Tanpa kunci, batas `null`, dan hitungan yang gagal → penambahan tetap
 *    boleh. Kalau tes ini gagal, instalasi yang sudah jalan produksi (Voliko) akan mulai
 *    menolak penambahan pengguna tanpa alasan yang bisa dijelaskan ke kliennya.
 *
 * 2. CARA MENGHITUNG "AKTIF". Yang diperiksa bukan cuma angkanya, tapi `where` yang dikirim ke
 *    Prisma: `isActive: true`, dan model `companyBranch` — BUKAN `branch` (titik Peta Cuan).
 *    Salah hitung ke atas berarti klien ditolak padahal belum penuh, dan itu lebih merusak
 *    kepercayaan daripada tidak menegakkan batas sama sekali.
 */
import { ForbiddenException } from '@nestjs/common';
import { BATAS_DITEGAKKAN, KODE_BATAS_DITEGAKKAN, namaPaket, putusanBatas } from './aturan-batas';
import { BatasService } from './batas.service';
import { Keadaan } from './keadaan-lisensi';
import { LisensiService } from './lisensi.service';
import { PrismaService } from '../prisma/prisma.service';

const KEADAAN_KOSONG: Keadaan = {
    ditegakkan: false,
    status: 'tanpa_lisensi',
    hanyaBaca: false,
    alasan: null,
    jamMundur: false,
    klien: null,
    namaKlien: null,
    produk: null,
    paket: null,
    fitur: [],
    batas: {},
    berlakuSampai: null,
    tenggangSampai: null,
    sisaHari: null,
    sisaHariTenggang: null,
    terakhirTerlihat: null,
};

/** LisensiService palsu — cuma `keadaan()` + `batasFitur()`, sama seperti yang dipakai BatasService. */
function lisensiPalsu(ubah: Partial<Keadaan> = {}): LisensiService {
    const keadaan: Keadaan = { ...KEADAAN_KOSONG, ...ubah };
    return {
        keadaan: () => keadaan,
        // Tiruan persis `batasLisensi()`: penegakan mati = null, kode yang tidak ada = null.
        batasFitur: (kode: string) => {
            if (!keadaan.ditegakkan) return null;
            const nilai = keadaan.batas[kode];
            return nilai === undefined ? null : nilai;
        },
    } as unknown as LisensiService;
}

/** Lisensi yang benar-benar ditegakkan, dengan batas apa adanya. */
const lisensiAktif = (batas: Record<string, number | null>, paket = 'usaha') =>
    lisensiPalsu({ ditegakkan: true, status: 'aktif', paket, batas });

function prismaPalsu(jumlah: { pengguna?: number; cabang?: number; meledak?: boolean } = {}) {
    const user = {
        count: jest.fn(() =>
            jumlah.meledak
                ? Promise.reject(new Error('ECONNREFUSED 127.0.0.1:3306'))
                : Promise.resolve(jumlah.pengguna ?? 0),
        ),
    };
    const companyBranch = {
        count: jest.fn(() => Promise.resolve(jumlah.cabang ?? 0)),
    };
    // Model `branch` (titik Peta Cuan) ikut disiapkan supaya tes bisa membuktikan dia TIDAK
    // pernah dipanggil. Angkanya dibuat besar: kalau tertukar, tesnya pasti merah.
    const branch = { count: jest.fn(() => Promise.resolve(99)) };
    return { user, companyBranch, branch } as unknown as PrismaService & {
        user: any;
        companyBranch: any;
        branch: any;
    };
}

const buat = (
    lisensi: LisensiService,
    jumlah: Parameters<typeof prismaPalsu>[0] = {},
) => {
    const prisma = prismaPalsu(jumlah);
    return { svc: new BatasService(prisma, lisensi), prisma };
};

// ── Aturan murni ───────────────────────────────────────────────────────────────────────

describe('putusanBatas — aturan murni', () => {
    it('batas null = TANPA BATAS, berapa pun yang sudah ada', () => {
        const p = putusanBatas({ kode: 'limit.users', batas: null, pemakaian: 900 });
        expect(p.boleh).toBe(true);
        expect(p.batas).toBeNull();
        expect(p.sisa).toBeNull();
        expect(p.pesan).toBeNull();
    });

    it('di bawah batas: boleh, dan sisanya dihitung', () => {
        const p = putusanBatas({ kode: 'limit.users', batas: 5, pemakaian: 4, paket: 'usaha' });
        expect(p.boleh).toBe(true);
        expect(p.sisa).toBe(1);
        expect(p.penuh).toBe(false);
        expect(p.pesan).toBeNull();
    });

    it('PAS di batas: ditolak, pesannya menyebut jumlah, batas, paket, dan dua jalan keluar', () => {
        const p = putusanBatas({ kode: 'limit.users', batas: 5, pemakaian: 5, paket: 'usaha' });
        expect(p.boleh).toBe(false);
        expect(p.penuh).toBe(true);
        expect(p.lewat).toBe(false);
        expect(p.sisa).toBe(0);
        expect(p.pesan).toBe(
            'Paket Usaha membatasi 5 pengguna, dan sekarang sudah ada 5. ' +
                'Naikkan paket di Pengaturan → Langganan, atau tandai pengguna lain keluar dulu.',
        );
    });

    it('DI ATAS batas (klien lama): ditolak menambah, tapi pesannya menegaskan yang lama tetap jalan', () => {
        const p = putusanBatas({ kode: 'limit.users', batas: 5, pemakaian: 8, paket: 'usaha' });
        expect(p.boleh).toBe(false);
        expect(p.lewat).toBe(true);
        expect(p.sisa).toBe(-3);
        expect(p.pesan).toContain('sudah ada 8');
        expect(p.pesan).toContain('tetap jalan seperti biasa');
        expect(p.pesan).toContain('Pengaturan → Langganan');
    });

    it('NOL = tidak termasuk paket, bukan tanpa batas', () => {
        const p = putusanBatas({ kode: 'limit.branches', batas: 0, pemakaian: 0, paket: 'gratis' });
        expect(p.boleh).toBe(false);
        expect(p.nol).toBe(true);
        expect(p.pesan).toContain('tidak memasukkan cabang sama sekali (batasnya 0)');
        // Yang penting: JANGAN pernah terbaca seperti `null`.
        expect(putusanBatas({ kode: 'limit.branches', batas: null, pemakaian: 0 }).boleh).toBe(true);
    });

    it('paket tanpa nama tetap menghasilkan kalimat yang bisa dibaca', () => {
        const p = putusanBatas({ kode: 'limit.branches', batas: 1, pemakaian: 1, paket: null });
        expect(p.pesan).toContain('Paket yang terpasang membatasi 1 cabang');
    });

    it('namaPaket: kode jadi nama yang enak dibaca', () => {
        expect(namaPaket('usaha')).toBe('Usaha');
        expect(namaPaket('vendor_event')).toBe('Vendor Event');
        expect(namaPaket('')).toBe('yang terpasang');
        expect(namaPaket(null)).toBe('yang terpasang');
    });

    it('hanya dua batas yang ditegakkan — customers & retention SENGAJA di luar', () => {
        expect(KODE_BATAS_DITEGAKKAN).toEqual(['limit.users', 'limit.branches']);
        expect(KODE_BATAS_DITEGAKKAN).not.toContain('limit.customers');
        expect(KODE_BATAS_DITEGAKKAN).not.toContain('limit.retention');
        expect(KODE_BATAS_DITEGAKKAN).not.toContain('limit.wa_percakapan');
        // Tiap jenis wajib punya kata-kata lengkap, kalau tidak pesannya jadi janggal.
        for (const j of BATAS_DITEGAKKAN) {
            expect(j.nama).toBeTruthy();
            expect(j.satuan).toBeTruthy();
            expect(j.saran).toBeTruthy();
        }
    });
});

// ── Gagal-terbuka ──────────────────────────────────────────────────────────────────────

describe('BatasService — gagal-terbuka', () => {
    it('TANPA KUNCI LISENSI: menambah selalu boleh, dan database tidak disentuh', async () => {
        const { svc, prisma } = buat(lisensiPalsu(), { pengguna: 500, cabang: 50 });

        await expect(svc.wajibBolehMenambah('limit.users')).resolves.toMatchObject({ boleh: true });
        await expect(svc.wajibBolehMenambah('limit.branches')).resolves.toMatchObject({ boleh: true });
        expect(prisma.user.count).not.toHaveBeenCalled();
        expect(prisma.companyBranch.count).not.toHaveBeenCalled();
    });

    it('batas null di kunci (paket tanpa batas): boleh, tanpa query', async () => {
        const { svc, prisma } = buat(lisensiAktif({ 'limit.users': null }, 'bisnis'), { pengguna: 300 });

        await expect(svc.wajibBolehMenambah('limit.users')).resolves.toMatchObject({ boleh: true });
        expect(prisma.user.count).not.toHaveBeenCalled();
    });

    it('kode batas TIDAK ADA di kunci = tanpa batas (jebakan yang sudah tercatat)', async () => {
        const { svc, prisma } = buat(lisensiAktif({ 'limit.branches': 1 }), { pengguna: 999 });

        await expect(svc.wajibBolehMenambah('limit.users')).resolves.toMatchObject({ boleh: true });
        expect(prisma.user.count).not.toHaveBeenCalled();
    });

    it('hitungannya gagal (database bermasalah): penambahan TIDAK ditolak', async () => {
        const { svc } = buat(lisensiAktif({ 'limit.users': 2 }), { meledak: true });

        const p = await svc.wajibBolehMenambah('limit.users');
        expect(p.boleh).toBe(true);
        expect(p.batas).toBeNull();
    });
});

// ── Penegakan ──────────────────────────────────────────────────────────────────────────

describe('BatasService.wajibBolehMenambah', () => {
    it('di bawah batas: lewat', async () => {
        const { svc } = buat(lisensiAktif({ 'limit.users': 5 }), { pengguna: 4 });
        await expect(svc.wajibBolehMenambah('limit.users')).resolves.toMatchObject({ boleh: true, sisa: 1 });
    });

    it('pas di batas: 403 dengan kode & angka yang bisa dipakai frontend', async () => {
        const { svc } = buat(lisensiAktif({ 'limit.users': 5 }), { pengguna: 5 });

        await expect(svc.wajibBolehMenambah('limit.users')).rejects.toThrow(ForbiddenException);
        try {
            await svc.wajibBolehMenambah('limit.users');
            throw new Error('seharusnya ditolak');
        } catch (e: any) {
            const isi = e.getResponse();
            expect(isi.statusCode).toBe(403);
            expect(isi.kode).toBe('lisensi_batas_penuh');
            expect(isi.batas).toEqual({ kode: 'limit.users', nilai: 5, pemakaian: 5 });
            expect(isi.message).toContain('Paket Usaha membatasi 5 pengguna');
        }
    });

    it('klien lama yang sudah DI ATAS batas: menambah ditolak, data lama tidak disentuh', async () => {
        const { svc, prisma } = buat(lisensiAktif({ 'limit.users': 5 }), { pengguna: 8 });

        await expect(svc.wajibBolehMenambah('limit.users')).rejects.toThrow(ForbiddenException);
        // Tidak ada update/delete/deactivate — BatasService memang tidak punya jalan ke sana,
        // dan tes ini yang menjaga supaya tidak pernah ditambahkan.
        expect(Object.keys(prisma.user)).toEqual(['count']);
        expect(prisma.user.count).toHaveBeenCalled();
    });

    it('batas cabang 0 (tidak termasuk paket): cabang pertama pun ditolak', async () => {
        const { svc } = buat(lisensiAktif({ 'limit.branches': 0 }, 'gratis'), { cabang: 0 });
        await expect(svc.wajibBolehMenambah('limit.branches')).rejects.toThrow(/batasnya 0/);
    });
});

// ── Cara menghitung "aktif" ────────────────────────────────────────────────────────────

describe('BatasService — hitungan mengabaikan yang nonaktif', () => {
    it('pengguna dihitung dengan isActive: true (karyawan keluar tidak ikut ditagih)', async () => {
        const { svc, prisma } = buat(lisensiAktif({ 'limit.users': 5 }), { pengguna: 3 });

        await svc.wajibBolehMenambah('limit.users');
        expect(prisma.user.count).toHaveBeenCalledWith({ where: { isActive: true } });
    });

    it('cabang dihitung dari companyBranch aktif — BUKAN model `branch` (titik Peta Cuan)', async () => {
        const { svc, prisma } = buat(lisensiAktif({ 'limit.branches': 3 }, 'bisnis'), { cabang: 2 });

        const p = await svc.wajibBolehMenambah('limit.branches');
        expect(prisma.companyBranch.count).toHaveBeenCalledWith({ where: { isActive: true } });
        expect(prisma.branch.count).not.toHaveBeenCalled();
        // 99 = jumlah titik Peta Cuan di prisma palsu. Kalau tertukar, hitungannya jadi 99.
        expect(p.pemakaian).toBe(2);
    });

    it('cabang yang nonaktif membuka slot baru (satu-satunya cara "menutup cabang")', async () => {
        // 3 cabang pernah dibuat, satu ditutup (isActive: false) → yang dihitung 2, batas 3.
        const { svc } = buat(lisensiAktif({ 'limit.branches': 3 }, 'bisnis'), { cabang: 2 });
        await expect(svc.wajibBolehMenambah('limit.branches')).resolves.toMatchObject({ boleh: true });
    });

    it('kode tanpa cara hitung = salah tulis programmer, bukan keadaan produksi', async () => {
        const { svc } = buat(lisensiAktif({ 'limit.customers': 500 }));
        await expect(svc.hitungPemakaian('limit.customers')).rejects.toThrow(/belum punya cara menghitung/);
    });
});

// ── Pemakaian untuk /saya/fitur ────────────────────────────────────────────────────────

describe('BatasService.ringkasanPemakaian (untuk GET /saya/fitur)', () => {
    it('tanpa kunci: {} dan nol query', async () => {
        const { svc, prisma } = buat(lisensiPalsu(), { pengguna: 7, cabang: 2 });
        await expect(svc.ringkasanPemakaian()).resolves.toEqual({});
        expect(prisma.user.count).not.toHaveBeenCalled();
    });

    it('hanya menghitung kode yang benar-benar punya batas', async () => {
        const { svc, prisma } = buat(
            lisensiAktif({ 'limit.users': 5, 'limit.branches': null }),
            { pengguna: 4, cabang: 2 },
        );

        await expect(svc.ringkasanPemakaian()).resolves.toEqual({ 'limit.users': 4 });
        expect(prisma.companyBranch.count).not.toHaveBeenCalled();
    });

    it('satu kode gagal dihitung: baris itu dilewati, endpoint tetap menjawab', async () => {
        const { svc } = buat(
            lisensiAktif({ 'limit.users': 5, 'limit.branches': 3 }, 'bisnis'),
            { meledak: true, cabang: 2 },
        );

        await expect(svc.ringkasanPemakaian()).resolves.toEqual({ 'limit.branches': 2 });
    });
});
