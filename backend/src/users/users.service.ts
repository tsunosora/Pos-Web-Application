import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) { }

  async create(createUserDto: any) {
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
        throw new Error('Cabang wajib dipilih untuk role non-Owner.');
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
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        branchId: true,
        role: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true, code: true } },
      },
    });
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
    return this.prisma.role.findMany({
      orderBy: { id: 'asc' }
    });
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
          throw new Error('Cabang wajib dipilih untuk role non-Owner.');
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
