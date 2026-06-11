import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async create(data: { name: string; parentId?: number | null; countsAsPcs?: boolean }) {
    // Cek nama duplikat dalam parent yang sama
    const existing = await (this.prisma as any).category.findFirst({
      where: { name: data.name, parentId: data.parentId ?? null },
    });
    if (existing) throw new BadRequestException('Nama kategori sudah ada dalam grup yang sama');

    return (this.prisma as any).category.create({
      data: {
        name: data.name,
        parentId: data.parentId ?? null,
        countsAsPcs: data.countsAsPcs ?? true,
      },
      include: { parent: true, children: true },
    });
  }

  async findAll() {
    // Kembalikan semua kategori beserta relasi parent & children
    return (this.prisma as any).category.findMany({
      include: {
        parent: { select: { id: true, name: true } },
        children: { orderBy: { name: 'asc' }, select: { id: true, name: true, parentId: true, countsAsPcs: true } },
      },
      orderBy: [{ parentId: 'asc' }, { name: 'asc' }],
    });
  }

  async findOne(id: number) {
    const category = await (this.prisma as any).category.findUnique({
      where: { id },
      include: { parent: true, children: true },
    });
    if (!category) throw new NotFoundException(`Category #${id} not found`);
    return category;
  }

  async update(id: number, data: { name: string; parentId?: number | null; countsAsPcs?: boolean }) {
    await this.findOne(id);

    // Cegah circular reference
    if (data.parentId != null && data.parentId === id) {
      throw new BadRequestException('Kategori tidak bisa menjadi sub-kategori dari dirinya sendiri');
    }

    // Cek nama duplikat dalam parent yang sama (kecuali diri sendiri)
    const existing = await (this.prisma as any).category.findFirst({
      where: { name: data.name, parentId: data.parentId ?? null, id: { not: id } },
    });
    if (existing) throw new BadRequestException('Nama kategori sudah ada dalam grup yang sama');

    return (this.prisma as any).category.update({
      where: { id },
      data: {
        name: data.name,
        parentId: data.parentId ?? null,
        ...(data.countsAsPcs !== undefined ? { countsAsPcs: !!data.countsAsPcs } : {}),
      },
      include: { parent: true, children: true },
    });
  }

  async remove(id: number) {
    const cat = await this.findOne(id);

    // Jika ada anak, pindahkan anak ke parent-nya (atau root) sebelum hapus
    if ((cat as any).children?.length > 0) {
      const parentId = (cat as any).parentId ?? null;
      await (this.prisma as any).category.updateMany({
        where: { parentId: id },
        data: { parentId },
      });
    }

    return this.prisma.category.delete({ where: { id } });
  }
}
