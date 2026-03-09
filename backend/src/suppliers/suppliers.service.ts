import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SuppliersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return (this.prisma as any).supplier.findMany({
      include: { items: { include: { productVariant: { include: { product: true } } } } },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: number) {
    const supplier = await (this.prisma as any).supplier.findUnique({
      where: { id },
      include: {
        items: {
          include: { productVariant: { include: { product: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!supplier) throw new NotFoundException(`Supplier #${id} tidak ditemukan`);
    return supplier;
  }

  async create(data: any) {
    return (this.prisma as any).supplier.create({
      data: {
        name: data.name,
        contactPerson: data.contactPerson || null,
        phone: data.phone || null,
        email: data.email || null,
        address: data.address || null,
        notes: data.notes || null,
      },
    });
  }

  async update(id: number, data: any) {
    await this.findOne(id);
    return (this.prisma as any).supplier.update({
      where: { id },
      data: {
        name: data.name,
        contactPerson: data.contactPerson ?? undefined,
        phone: data.phone ?? undefined,
        email: data.email ?? undefined,
        address: data.address ?? undefined,
        notes: data.notes ?? undefined,
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return (this.prisma as any).supplier.delete({ where: { id } });
  }

  async addItem(supplierId: number, data: any) {
    await this.findOne(supplierId);
    return (this.prisma as any).supplierItem.create({
      data: {
        supplierId,
        productVariantId: Number(data.productVariantId),
        purchasePrice: Number(data.purchasePrice),
        notes: data.notes || null,
      },
      include: { productVariant: { include: { product: true } } },
    });
  }

  async updateItem(itemId: number, data: any) {
    return (this.prisma as any).supplierItem.update({
      where: { id: itemId },
      data: {
        purchasePrice: data.purchasePrice !== undefined ? Number(data.purchasePrice) : undefined,
        notes: data.notes ?? undefined,
      },
      include: { productVariant: { include: { product: true } } },
    });
  }

  async removeItem(itemId: number) {
    return (this.prisma as any).supplierItem.delete({ where: { id: itemId } });
  }
}
