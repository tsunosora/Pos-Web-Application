import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) { }

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

  async create(createUserDto: any) {
    // Cegah email duplikat dengan pesan jelas (409) alih-alih error Prisma mentah (500).
    const existing = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });
    if (existing) {
      throw new ConflictException('Email sudah terdaftar.');
    }

    const salt = await bcrypt.genSalt();
    const passwordHash = await bcrypt.hash(createUserDto.password, salt);

    // Multi-cabang: validasi branchId — kalau role bukan Owner/SuperAdmin, branchId wajib.
    const roleId = createUserDto.roleId ? parseInt(createUserDto.roleId.toString()) : null;
    let branchId: number | null = createUserDto.branchId
      ? parseInt(createUserDto.branchId.toString())
      : null;

    if (roleId) {
      const role = await this.prisma.role.findUnique({ where: { id: roleId } });
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

  async updateUser(id: number, data: { name?: string, roleId?: number, phone?: string, password?: string, branchId?: number | null }) {
    let updateData: any = {
      name: data.name,
      phone: data.phone,
      roleId: data.roleId || null,
    };

    // Multi-cabang: validasi & set branchId hanya kalau branchId dikirim secara eksplisit.
    // Kalau hanya roleId yang berubah (inline role-change), jangan sentuh branchId sama sekali.
    if (data.branchId !== undefined) {
      const roleId = data.roleId != null ? parseInt(data.roleId.toString()) : null;
      let branchId: number | null = data.branchId != null ? parseInt(data.branchId.toString()) : null;

      if (roleId) {
        const role = await this.prisma.role.findUnique({ where: { id: roleId } });
        const roleName = role?.name?.toUpperCase() ?? '';
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

  async deleteUser(id: number) {
    return this.prisma.user.delete({
      where: { id }
    });
  }

  async createRole(name: string) {
    return this.prisma.role.create({
      data: { name }
    });
  }

  async updateRole(id: number, name: string) {
    return this.prisma.role.update({
      where: { id },
      data: { name }
    });
  }

  async deleteRole(id: number) {
    return this.prisma.role.delete({
      where: { id }
    });
  }
}
