import { Injectable, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { isManagerLevelRole, isOwnerLevelRole } from '../auth/role-groups';
import * as bcrypt from 'bcrypt';

/** Pelaku aksi (dari req.user) — dasar batas wewenang owner vs admin/manajer. */
export interface UserActor {
  userId: number | null;
  roleName: string | null;
  branchId: number | null;
}

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) { }

  /**
   * Non-owner (admin/manajer) hanya boleh mengelola akun di cabangnya sendiri
   * dan tak boleh menyentuh akun setingkat owner.
   */
  private assertCanManage(actor: UserActor, target: { branchId: number | null; roleName?: string | null }) {
    if (isOwnerLevelRole(actor.roleName)) return;
    if (isOwnerLevelRole(target.roleName)) {
      throw new ForbiddenException('Akun owner hanya bisa diubah oleh owner.');
    }
    if (actor.branchId == null || target.branchId !== actor.branchId) {
      throw new ForbiddenException('Anda hanya boleh mengelola akun di cabang Anda sendiri.');
    }
  }

  /** Peran setingkat owner hanya boleh diberikan oleh owner. */
  private assertCanAssignRole(actor: UserActor, roleName: string | null | undefined) {
    if (isOwnerLevelRole(roleName) && !isOwnerLevelRole(actor.roleName)) {
      throw new ForbiddenException('Hanya owner yang boleh memberi peran owner.');
    }
  }

  /** Parse kolom menuAccess (JSON string) → array href, atau null bila belum diatur. */
  private parseMenuAccess(raw: any): string[] | null {
    if (raw == null) return null;
    try {
      const v = JSON.parse(raw);
      return Array.isArray(v) ? v.filter((s) => typeof s === 'string') : null;
    } catch {
      return null;
    }
  }

  async create(createUserDto: any, actor: UserActor) {
    // Multi-cabang: validasi branchId — kalau role bukan Owner/SuperAdmin, branchId wajib.
    const roleId = createUserDto.roleId ? parseInt(createUserDto.roleId.toString()) : null;
    let branchId: number | null = createUserDto.branchId
      ? parseInt(createUserDto.branchId.toString())
      : null;
    const role = roleId ? await this.prisma.role.findUnique({ where: { id: roleId } }) : null;
    if (roleId && !role) throw new BadRequestException('Role tidak ditemukan.');
    this.assertCanAssignRole(actor, role?.name);
    if (!isOwnerLevelRole(actor.roleName) && (actor.branchId == null || branchId !== actor.branchId)) {
      throw new ForbiddenException('Anda hanya boleh membuat akun di cabang Anda sendiri.');
    }

    // Cegah email duplikat dengan pesan jelas (409) alih-alih error Prisma mentah (500).
    const existing = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });
    if (existing) {
      throw new ConflictException('Email sudah terdaftar.');
    }

    const salt = await bcrypt.genSalt();
    const passwordHash = await bcrypt.hash(createUserDto.password, salt);

    if (roleId) {
      const roleName = role?.name?.toUpperCase() ?? '';
      const isOwner = ['OWNER', 'SUPERADMIN', 'SUPER_ADMIN'].includes(roleName);
      if (!isOwner && branchId == null) {
        throw new BadRequestException('Cabang wajib dipilih untuk role non-Owner.');
      }
      if (isOwner) branchId = null; // Owner selalu null
    }

    return this.prisma.user.create({
      data: {
        name: createUserDto.name,
        email: createUserDto.email,
        phone: createUserDto.phone,
        passwordHash,
        roleId,
        branchId,
      },
      // Jangan pernah kembalikan passwordHash (T-04) — sama dengan updateUser.
      select: {
        id: true, name: true, email: true, phone: true, role: true,
        branchId: true, branch: { select: { id: true, name: true, code: true } }
      }
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: { role: true },
    });
  }

  async findById(id: number) {
    const u = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        branchId: true,
        isActive: true,
        role: { select: { id: true, name: true, menuAccess: true } },
        branch: { select: { id: true, name: true, code: true } },
      },
    });
    // Kembalikan menuAccess sebagai array (atau null) agar frontend gampang pakai.
    if (u?.role) (u.role as any).menuAccess = this.parseMenuAccess((u.role as any).menuAccess);
    return u;
  }

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        roleId: true,
        role: true,
        branchId: true,
        branch: { select: { id: true, name: true, code: true } },
        isActive: true,
        resignedAt: true,
        resignNote: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async fetchRoles() {
    const roles = await this.prisma.role.findMany({ orderBy: { id: 'asc' } });
    return roles.map((r) => ({ ...r, menuAccess: this.parseMenuAccess((r as any).menuAccess) }));
  }

  /** Set daftar menu yang boleh dilihat sebuah role. `hrefs=null` → reset ke preset divisi. */
  async updateRoleMenuAccess(id: number, hrefs: string[] | null) {
    const menuAccess =
      Array.isArray(hrefs) ? JSON.stringify(hrefs.filter((s) => typeof s === 'string')) : null;
    const r = await this.prisma.role.update({ where: { id }, data: { menuAccess } });
    return { ...r, menuAccess: this.parseMenuAccess((r as any).menuAccess) };
  }

  async updateUser(
    id: number,
    data: { name?: string, roleId?: number | null, phone?: string, password?: string, branchId?: number | null },
    actor: UserActor,
  ) {
    const target = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, branchId: true, role: { select: { name: true } } },
    });
    if (!target) throw new BadRequestException('Pengguna tidak ditemukan.');
    this.assertCanManage(actor, { branchId: target.branchId, roleName: target.role?.name });

    // Hanya kolom yang DIKIRIM yang diubah — edit HP inline ({phone}) dulu ikut
    // mengosongkan peran karena `roleId: data.roleId || null`.
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.phone !== undefined) updateData.phone = data.phone;

    let newRole: { name: string } | null = null;
    if (data.roleId !== undefined) {
      const roleId = data.roleId ? parseInt(data.roleId.toString()) : null;
      if (roleId) {
        newRole = await this.prisma.role.findUnique({ where: { id: roleId } });
        if (!newRole) throw new BadRequestException('Role tidak ditemukan.');
      }
      this.assertCanAssignRole(actor, newRole?.name);
      updateData.roleId = roleId;
    }

    // Multi-cabang: validasi & set branchId hanya kalau branchId dikirim secara eksplisit.
    // Kalau hanya roleId yang berubah (inline role-change), jangan sentuh branchId sama sekali.
    if (data.branchId !== undefined) {
      const roleId = data.roleId ? parseInt(data.roleId.toString()) : null;
      let branchId: number | null = data.branchId != null ? parseInt(data.branchId.toString()) : null;
      if (!isOwnerLevelRole(actor.roleName) && branchId !== actor.branchId) {
        throw new ForbiddenException('Tidak boleh memindahkan akun ke cabang lain.');
      }

      if (roleId) {
        const roleName = newRole?.name?.toUpperCase() ?? '';
        const isOwner = ['OWNER', 'SUPERADMIN', 'SUPER_ADMIN'].includes(roleName);
        if (!isOwner && branchId == null) {
          throw new BadRequestException('Cabang wajib dipilih untuk role non-Owner.');
        }
        if (isOwner) branchId = null;
      }
      updateData.branchId = branchId;
    }

    if (data.password) {
      const salt = await bcrypt.genSalt();
      updateData.passwordHash = await bcrypt.hash(data.password, salt);
    }

    return this.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true, name: true, email: true, phone: true, role: true,
        branchId: true, branch: { select: { id: true, name: true, code: true } }
      }
    });
  }

  /** Role lintas cabang — dipakai utk jaga agar Owner aktif terakhir tak ikut dimatikan. */
  private static readonly OWNER_ROLES = ['OWNER', 'SUPERADMIN', 'SUPER_ADMIN'];

  /**
   * Hitung jejak kerja user di tabel lain. Dipakai sebelum hapus permanen: FK
   * ke `users` dipasang SET NULL (19 kolom) jadi menghapus akun akan
   * MENGOSONGKAN riwayat (atribusi CS di leaderboard, pencatat kas, riwayat
   * tugas, dst) tanpa peringatan — 2 tabel lain malah RESTRICT (error mentah).
   */
  /**
   * Kolom FK ke `users` yang menyimpan jejak kerja seseorang. Ditulis deklaratif
   * supaya bisa dicocokkan dengan skema Prisma di unit test (salah nama field
   * cuma ketahuan saat runtime kalau ditulis inline).
   */
  static readonly HISTORY_FK: { model: string; fields: string[]; label: string }[] = [
    { model: 'cashflow', fields: ['userId'], label: 'catatan kas' },
    { model: 'cashflowChangeRequest', fields: ['requesterId', 'reviewedBy'], label: 'pengajuan koreksi kas' },
    { model: 'transactionEditRequest', fields: ['requestedById', 'reviewedById'], label: 'pengajuan edit nota' },
    { model: 'lead', fields: ['assignedToId', 'createdById'], label: 'lead CRM' },
    { model: 'customer', fields: ['assignedCsId'], label: 'pelanggan (CS)' },
    { model: 'leadActivity', fields: ['createdById'], label: 'aktivitas lead' },
    { model: 'followUp', fields: ['assignedToId', 'createdById'], label: 'follow-up' },
    { model: 'csRatingResponse', fields: ['assignedCsId'], label: 'penilaian CS' },
    { model: 'waMessage', fields: ['sentById'], label: 'pesan WhatsApp' },
    { model: 'waConversation', fields: ['assignedToId'], label: 'percakapan WhatsApp' },
    { model: 'socialConversation', fields: ['assignedToId'], label: 'percakapan medsos' },
    { model: 'socialMessage', fields: ['sentById'], label: 'pesan medsos' },
    { model: 'socialComment', fields: ['sentById'], label: 'balasan komentar medsos' },
    { model: 'stockTransfer', fields: ['createdById'], label: 'transfer stok' },
    { model: 'taskItem', fields: ['assigneeId', 'completedById'], label: 'tugas karyawan' },
    { model: 'taskSchedule', fields: ['assigneeId', 'createdById'], label: 'jadwal tugas' },
  ];

  /**
   * Hitung jejak kerja user di tabel lain. Dipakai sebelum hapus permanen: FK
   * ke `users` dipasang SET NULL (19 kolom) jadi menghapus akun akan
   * MENGOSONGKAN riwayat (atribusi CS di leaderboard, pencatat kas, riwayat
   * tugas, dst) tanpa peringatan — 2 tabel lain malah RESTRICT (error mentah).
   */
  private async historySummary(id: number): Promise<string[]> {
    const db = this.prisma as any;
    const counts: number[] = await Promise.all(
      UsersService.HISTORY_FK.map((h) =>
        db[h.model].count({
          where:
            h.fields.length === 1
              ? { [h.fields[0]]: id }
              : { OR: h.fields.map((f) => ({ [f]: id })) },
        }),
      ),
    );
    return UsersService.HISTORY_FK
      .map((h, i) => ({ label: h.label, n: Number(counts[i]) || 0 }))
      .filter((h) => h.n > 0)
      .map((h) => `${h.n} ${h.label}`);
  }

  /**
   * Tandai karyawan keluar / aktifkan kembali.
   * - `active: false` → tak bisa login lagi (token yang sudah ada pun langsung
   *   mati karena JwtStrategy cek isActive tiap request) + akun PIN desainer/
   *   operator yang tertaut ikut dinonaktifkan (PIN pintu terpisah dari login
   *   email — lihat Designer.isActive).
   * - `active: true` → status & PIN dipulihkan, tanggal keluar dihapus.
   * Riwayat kerja tidak pernah dihapus.
   */
  async setStatus(
    id: number,
    data: { active: boolean; note?: string | null },
    actor: UserActor,
  ) {
    const actorUserId = actor.userId;
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, isActive: true, branchId: true, role: { select: { name: true } } },
    });
    if (!user) throw new BadRequestException('Pengguna tidak ditemukan.');
    this.assertCanManage(actor, { branchId: user.branchId ?? null, roleName: user.role?.name });

    const active = !!data.active;
    if (!active) {
      if (actorUserId != null && actorUserId === id) {
        throw new BadRequestException('Tidak bisa menandai akun Anda sendiri keluar.');
      }
      const isOwner = UsersService.OWNER_ROLES.includes((user.role?.name ?? '').toUpperCase());
      if (isOwner) {
        const otherOwners = await this.prisma.user.count({
          where: {
            id: { not: id },
            isActive: true,
            role: { name: { in: UsersService.OWNER_ROLES } },
          },
        });
        if (otherOwners === 0) {
          throw new BadRequestException(
            'Ini akun Owner aktif terakhir. Menonaktifkannya bisa mengunci semua orang dari pengaturan.',
          );
        }
      }
    }

    const note = typeof data.note === 'string' ? data.note.trim().slice(0, 255) : '';
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        isActive: active,
        resignedAt: active ? null : new Date(),
        resignNote: active ? null : note || null,
      },
      select: {
        id: true, name: true, email: true, phone: true, roleId: true, role: true,
        branchId: true, branch: { select: { id: true, name: true, code: true } },
        isActive: true, resignedAt: true, resignNote: true, createdAt: true,
      },
    });

    // PIN (halaman /so-designer, /produksi, /cetak) pintu terpisah → ikut ditutup.
    const pin = await (this.prisma as any).designer.updateMany({
      where: { userId: id },
      data: { isActive: active },
    });

    return { ...updated, pinAccountsChanged: Number(pin?.count) || 0 };
  }

  /**
   * Hapus permanen — HANYA untuk akun yang belum pernah dipakai (mis. salah
   * buat). Akun yang sudah punya jejak kerja wajib pakai `setStatus` supaya
   * laporan & leaderboard bulan lalu tidak berubah.
   */
  async deleteUser(id: number, actor: UserActor) {
    if (actor.userId != null && actor.userId === id) {
      throw new BadRequestException('Tidak bisa menghapus akun Anda sendiri.');
    }
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, isActive: true, branchId: true, role: { select: { name: true } } },
    });
    if (!user) throw new BadRequestException('Pengguna tidak ditemukan.');
    this.assertCanManage(actor, { branchId: user.branchId ?? null, roleName: user.role?.name });
    // Sama dengan setStatus: Owner aktif terakhir tak boleh hilang.
    if (user.isActive !== false && UsersService.OWNER_ROLES.includes((user.role?.name ?? '').toUpperCase())) {
      const otherOwners = await this.prisma.user.count({
        where: { id: { not: id }, isActive: true, role: { name: { in: UsersService.OWNER_ROLES } } },
      });
      if (otherOwners === 0) {
        throw new BadRequestException(
          'Ini akun Owner aktif terakhir. Menghapusnya bisa mengunci semua orang dari pengaturan.',
        );
      }
    }
    const history = await this.historySummary(id);
    if (history.length) {
      throw new BadRequestException(
        `Akun ini sudah punya riwayat (${history.join(', ')}). Menghapusnya akan mengosongkan data itu dari laporan. Pakai "Tandai keluar" — akunnya mati tapi riwayatnya utuh.`,
      );
    }
    return this.prisma.user.delete({
      where: { id }
    });
  }

  private cleanRoleName(name: unknown): string {
    const n = String(name ?? '').trim();
    if (!n) throw new BadRequestException('Nama role wajib diisi.');
    if (n.length > 20) throw new BadRequestException('Nama role maksimal 20 karakter.');
    return n;
  }

  async createRole(name: string, actor: UserActor) {
    const n = this.cleanRoleName(name);
    if (isOwnerLevelRole(n) && !isOwnerLevelRole(actor.roleName)) {
      throw new ForbiddenException('Hanya owner yang boleh membuat role owner.');
    }
    if (isManagerLevelRole(n) && !isOwnerLevelRole(actor.roleName)) {
      throw new ForbiddenException('Hanya owner yang boleh membuat peran setingkat manajer.');
    }
    return this.prisma.role.create({
      data: { name: n }
    });
  }

  async updateRole(id: number, name: string, actor: UserActor) {
    const n = this.cleanRoleName(name);
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new BadRequestException('Role tidak ditemukan.');
    if ((isOwnerLevelRole(role.name) || isOwnerLevelRole(n)) && !isOwnerLevelRole(actor.roleName)) {
      throw new ForbiddenException('Hanya owner yang boleh mengubah role owner.');
    }
    // Nama peran menentukan level akses (mis. "Kasir" → "Manajer" menaikkan SEMUA akunnya di
    // semua cabang). Melintasi batas setingkat-manajer hanya boleh oleh owner.
    if (isManagerLevelRole(role.name) !== isManagerLevelRole(n) && !isOwnerLevelRole(actor.roleName)) {
      throw new ForbiddenException('Hanya owner yang boleh mengubah level peran (setingkat manajer ↔ staf).');
    }
    return this.prisma.role.update({
      where: { id },
      data: { name: n }
    });
  }

  async deleteRole(id: number, actor: UserActor) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new BadRequestException('Role tidak ditemukan.');
    if (isOwnerLevelRole(role.name) && !isOwnerLevelRole(actor.roleName)) {
      throw new ForbiddenException('Hanya owner yang boleh menghapus role owner.');
    }
    const dipakai = await this.prisma.user.count({ where: { roleId: id } });
    if (dipakai > 0) {
      throw new BadRequestException(`Role masih dipakai ${dipakai} akun. Pindahkan akunnya ke role lain dulu.`);
    }
    return this.prisma.role.delete({
      where: { id }
    });
  }
}
