import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { UsersService } from './users.service';

/**
 * Karyawan keluar/resign: akun TIDAK dihapus (FK ke `users` SET NULL di 19 kolom
 * → riwayat lead/kas/tugas ikut kosong), cukup dinonaktifkan + tanggal keluar.
 * PIN desainer/operator adalah pintu terpisah dari login email, jadi harus ikut
 * ditutup.
 */

const COUNT_MODELS = UsersService.HISTORY_FK.map((h) => h.model);

function makeSvc(
  opts: {
    user?: any;
    ownerCount?: number;
    history?: Record<string, number>;
    pinCount?: number;
  } = {},
) {
  const prisma: any = {
    user: {
      findUnique: jest.fn(() =>
        Promise.resolve(
          opts.user === undefined
            ? {
                id: 5,
                name: 'Karyawan',
                isActive: true,
                role: { name: 'KASIR' },
              }
            : opts.user,
        ),
      ),
      update: jest.fn((args: any) => Promise.resolve({ id: 5, ...args.data })),
      count: jest.fn(() => Promise.resolve(opts.ownerCount ?? 1)),
      delete: jest.fn(() => Promise.resolve({ id: 5 })),
    },
    designer: {
      updateMany: jest.fn(() => Promise.resolve({ count: opts.pinCount ?? 1 })),
    },
  };
  for (const m of COUNT_MODELS) {
    prisma[m] = {
      count: jest.fn(() => Promise.resolve(opts.history?.[m] ?? 0)),
    };
  }
  const svc = new UsersService(prisma);
  return { svc, prisma };
}

describe('UsersService.setStatus — tandai karyawan keluar', () => {
  it('menonaktifkan akun, mencatat tanggal keluar & mematikan PIN yang tertaut', async () => {
    const { svc, prisma } = makeSvc({ pinCount: 2 });

    const res = await svc.setStatus(
      5,
      { active: false, note: 'Resign 18 Sep' },
      9,
    );

    const data = prisma.user.update.mock.calls[0][0].data;
    expect(data.isActive).toBe(false);
    expect(data.resignedAt).toBeInstanceOf(Date);
    expect(data.resignNote).toBe('Resign 18 Sep');
    expect(prisma.designer.updateMany).toHaveBeenCalledWith({
      where: { userId: 5 },
      data: { isActive: false },
    });
    expect(res.pinAccountsChanged).toBe(2);
  });

  it('aktifkan kembali → tanggal keluar dihapus & PIN dipulihkan', async () => {
    const { svc, prisma } = makeSvc({
      user: {
        id: 5,
        name: 'Karyawan',
        isActive: false,
        role: { name: 'KASIR' },
      },
    });

    await svc.setStatus(5, { active: true }, 9);

    const data = prisma.user.update.mock.calls[0][0].data;
    expect(data.isActive).toBe(true);
    expect(data.resignedAt).toBeNull();
    expect(data.resignNote).toBeNull();
    expect(prisma.designer.updateMany).toHaveBeenCalledWith({
      where: { userId: 5 },
      data: { isActive: true },
    });
  });

  it('tidak boleh menandai akun sendiri keluar', async () => {
    const { svc, prisma } = makeSvc();
    await expect(svc.setStatus(5, { active: false }, 5)).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('tidak boleh mematikan akun Owner aktif terakhir', async () => {
    const { svc, prisma } = makeSvc({
      user: { id: 5, name: 'Owner', isActive: true, role: { name: 'Owner' } },
      ownerCount: 0,
    });
    await expect(svc.setStatus(5, { active: false }, 9)).rejects.toThrow(
      /Owner aktif terakhir/,
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('Owner boleh dimatikan kalau masih ada Owner aktif lain', async () => {
    const { svc, prisma } = makeSvc({
      user: {
        id: 5,
        name: 'Owner lama',
        isActive: true,
        role: { name: 'OWNER' },
      },
      ownerCount: 1,
    });
    await svc.setStatus(5, { active: false }, 9);
    expect(prisma.user.update).toHaveBeenCalled();
  });
});

describe('UsersService.deleteUser — pengaman riwayat', () => {
  it('menolak hapus akun yang sudah punya jejak kerja & menyebut jumlahnya', async () => {
    const { svc, prisma } = makeSvc({ history: { lead: 12, cashflow: 3 } });

    await expect(svc.deleteUser(5)).rejects.toThrow(
      /12 lead CRM|3 catatan kas/,
    );
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });

  it('akun yang belum pernah dipakai tetap boleh dihapus', async () => {
    const { svc, prisma } = makeSvc();
    await svc.deleteUser(5);
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 5 } });
  });
});

describe('UsersService.HISTORY_FK — nama model & kolom harus ada di skema Prisma', () => {
  const models = new Map(
    Prisma.dmmf.datamodel.models.map((m) => [
      m.name.charAt(0).toLowerCase() + m.name.slice(1),
      new Set(m.fields.filter((f) => f.kind === 'scalar').map((f) => f.name)),
    ]),
  );

  it.each(UsersService.HISTORY_FK)('%s', ({ model, fields }) => {
    const scalars = models.get(model);
    expect(scalars).toBeDefined();
    for (const f of fields) expect(Array.from(scalars!)).toContain(f);
  });

  it('tidak ada kolom FK ke users yang terlewat dari perhitungan', () => {
    // Ambil SEMUA kolom FK ke User langsung dari skema, jadi kalau nanti ada
    // relasi baru ke users, tes ini gagal sampai relasinya diputuskan: ikut
    // dihitung sebagai riwayat, atau sengaja dikecualikan di bawah.
    const semua = new Set<string>();
    for (const m of Prisma.dmmf.datamodel.models) {
      const model = m.name.charAt(0).toLowerCase() + m.name.slice(1);
      for (const f of m.fields) {
        if (f.kind === 'object' && f.type === 'User') {
          for (const fk of f.relationFromFields ?? [])
            semua.add(`${model}.${fk}`);
        }
      }
    }
    // Dikecualikan dengan sengaja: keanggotaan grup tugas (CASCADE, sekadar
    // daftar anggota — bukan jejak kerja) & relasi balik di model User sendiri.
    const dikecualikan = new Set(['taskGroupMember.userId']);
    const dihitung = new Set(
      UsersService.HISTORY_FK.flatMap((h) =>
        h.fields.map((f) => `${h.model}.${f}`),
      ),
    );
    const terlewat = Array.from(semua).filter(
      (k) => !dihitung.has(k) && !dikecualikan.has(k) && !k.startsWith('user.'),
    );
    expect(terlewat).toEqual([]);
  });
});
