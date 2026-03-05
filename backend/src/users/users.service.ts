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

    return this.prisma.user.create({
      data: {
        name: createUserDto.name,
        email: createUserDto.email,
        phone: createUserDto.phone,
        passwordHash,
        roleId: createUserDto.roleId ? parseInt(createUserDto.roleId.toString()) : null,
      },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: { role: true },
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

  async updateUser(id: number, data: { name?: string, roleId?: number, phone?: string, password?: string }) {
    let updateData: any = {
      name: data.name,
      phone: data.phone,
      roleId: data.roleId || null,
    };

    if (data.password) {
      const salt = await bcrypt.genSalt();
      updateData.passwordHash = await bcrypt.hash(data.password, salt);
    }

    return this.prisma.user.update({
      where: { id },
      data: updateData,
      select: { id: true, name: true, email: true, phone: true, role: true }
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
