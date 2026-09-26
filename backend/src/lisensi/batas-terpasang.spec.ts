/**
 * Batasnya benar-benar TERPASANG di dua tempat penambahan, dan TIDAK terpasang di tempat lain.
 *
 * Tes di `batas.spec.ts` membuktikan keputusannya benar. Yang ini membuktikan keputusan itu
 * dipanggil — dan dipanggil SEBELUM barisnya dibuat. Tanpa tes semacam ini, `batas.service.ts`
 * bisa sempurna tapi tidak pernah dijalankan siapa pun, dan itu ketahuannya cuma dari klien
 * yang jumlah penggunanya melewati paketnya.
 *
 * Sekaligus menjaga keputusan pemilik: klien yang sudah lewat batas TIDAK kehilangan apa pun —
 * `create` ditolak, sementara `update`/`setStatus`/`remove` tidak pernah bertanya soal batas.
 */
import { ForbiddenException } from '@nestjs/common';
import { CompanyBranchesService } from '../company-branches/company-branches.service';
import { UsersService } from '../users/users.service';
import { BatasService } from './batas.service';

/** Pemeriksa batas palsu: mencatat kode apa yang ditanyakan, dan boleh disetel untuk menolak. */
function batasPalsu(tolak: string | null = null) {
    const ditanya: string[] = [];
    const svc = {
        wajibBolehMenambah: jest.fn(async (kode: string) => {
            ditanya.push(kode);
            if (tolak === kode) {
                throw new ForbiddenException({ kode: 'lisensi_batas_penuh', message: 'Sudah penuh (tes).' });
            }
            return { kode, boleh: true } as any;
        }),
    } as unknown as BatasService;
    return { svc, ditanya };
}

const owner = { userId: 1, roleName: 'Owner', branchId: null };

// ── Pengguna ───────────────────────────────────────────────────────────────────────────

describe('UsersService.create — batas limit.users', () => {
    const prismaPengguna = () => {
        const prisma: any = {
            role: { findUnique: jest.fn(() => Promise.resolve({ id: 2, name: 'KASIR' })) },
            user: {
                findUnique: jest.fn(() => Promise.resolve(null)), // email belum terpakai
                create: jest.fn((args: any) => Promise.resolve({ id: 10, ...args.data })),
            },
        };
        return prisma;
    };

    const dto = { name: 'Kasir Baru', email: 'kasir@toko.test', password: 'rahasia123', roleId: 2, branchId: 1 };

    it('di bawah batas: pengguna dibuat, dan batas limit.users memang ditanyakan', async () => {
        const prisma = prismaPengguna();
        const { svc: batas, ditanya } = batasPalsu();

        await new UsersService(prisma, batas).create({ ...dto }, owner);

        expect(ditanya).toEqual(['limit.users']);
        expect(prisma.user.create).toHaveBeenCalled();
    });

    it('batas penuh: ditolak 403, dan TIDAK ADA baris pengguna yang dibuat', async () => {
        const prisma = prismaPengguna();
        const { svc: batas } = batasPalsu('limit.users');

        await expect(new UsersService(prisma, batas).create({ ...dto }, owner)).rejects.toThrow(
            ForbiddenException,
        );
        expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('email yang sudah terdaftar dijawab 409 lebih dulu — batas tidak ikut ditanya', async () => {
        const prisma = prismaPengguna();
        prisma.user.findUnique = jest.fn(() => Promise.resolve({ id: 3, email: dto.email }));
        const { svc: batas, ditanya } = batasPalsu('limit.users');

        await expect(new UsersService(prisma, batas).create({ ...dto }, owner)).rejects.toThrow(
            /Email sudah terdaftar/,
        );
        expect(ditanya).toEqual([]);
    });

    it('wewenang diperiksa DULU: admin cabang lain ditolak tanpa pernah menyentuh batas', async () => {
        const prisma = prismaPengguna();
        const { svc: batas, ditanya } = batasPalsu();
        const adminCabang2 = { userId: 5, roleName: 'ADMIN', branchId: 2 };

        await expect(
            new UsersService(prisma, batas).create({ ...dto, branchId: 1 }, adminCabang2),
        ).rejects.toThrow(ForbiddenException);
        // Penting: jumlah pengguna klien tidak boleh ikut bocor ke orang yang tidak berhak.
        expect(ditanya).toEqual([]);
    });

    it('MENGHIDUPKAN kembali akun lama (setStatus) tidak pernah menanyakan batas', async () => {
        const prisma: any = {
            user: {
                findUnique: jest.fn(() => Promise.resolve({ id: 5, name: 'Budi', isActive: false, branchId: null, role: { name: 'KASIR' } })),
                update: jest.fn((args: any) => Promise.resolve({ id: 5, ...args.data })),
                count: jest.fn(() => Promise.resolve(1)),
            },
            designer: { updateMany: jest.fn(() => Promise.resolve({ count: 0 })) },
        };
        const { svc: batas, ditanya } = batasPalsu('limit.users');

        // Sengaja begini (keputusan pemilik): yang ditolak hanya PENAMBAHAN. Klien yang lewat
        // batas harus tetap bisa merapikan daftar karyawannya, dan itu justru jalan keluarnya.
        await new UsersService(prisma, batas).setStatus(5, { active: true }, owner);
        expect(ditanya).toEqual([]);
    });
});

// ── Cabang ─────────────────────────────────────────────────────────────────────────────

describe('CompanyBranchesService.create — batas limit.branches', () => {
    const prismaCabang = () => {
        const prisma: any = {
            companyBranch: {
                create: jest.fn((args: any) => Promise.resolve({ id: 4, ...args.data })),
                findUnique: jest.fn(() => Promise.resolve({ id: 4, name: 'Cabang Lama', isActive: true })),
                update: jest.fn((args: any) => Promise.resolve({ id: 4, ...args.data })),
            },
        };
        return prisma;
    };

    it('di bawah batas: cabang dibuat, dan batas limit.branches memang ditanyakan', async () => {
        const prisma = prismaCabang();
        const { svc: batas, ditanya } = batasPalsu();

        await new CompanyBranchesService(prisma, batas).create({ name: 'Cabang Bantul' });

        expect(ditanya).toEqual(['limit.branches']);
        expect(prisma.companyBranch.create).toHaveBeenCalled();
    });

    it('batas penuh: ditolak 403, dan TIDAK ADA cabang yang dibuat', async () => {
        const prisma = prismaCabang();
        const { svc: batas } = batasPalsu('limit.branches');

        await expect(
            new CompanyBranchesService(prisma, batas).create({ name: 'Cabang Bantul' }),
        ).rejects.toThrow(ForbiddenException);
        expect(prisma.companyBranch.create).not.toHaveBeenCalled();
    });

    it('nama kosong tetap 400 lebih dulu — batas bukan pemeriksa isian', async () => {
        const prisma = prismaCabang();
        const { svc: batas, ditanya } = batasPalsu('limit.branches');

        await expect(new CompanyBranchesService(prisma, batas).create({ name: '  ' })).rejects.toThrow(
            /Nama cabang wajib diisi/,
        );
        expect(ditanya).toEqual([]);
    });

    it('mengubah / menyalakan kembali cabang tidak pernah menanyakan batas', async () => {
        const prisma = prismaCabang();
        const { svc: batas, ditanya } = batasPalsu('limit.branches');

        await new CompanyBranchesService(prisma, batas).update(4, { isActive: true, name: 'Cabang Lama' });
        expect(ditanya).toEqual([]);
        expect(prisma.companyBranch.update).toHaveBeenCalled();
    });
});
