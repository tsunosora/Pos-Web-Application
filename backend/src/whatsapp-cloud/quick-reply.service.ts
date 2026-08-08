import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateQuickReplyInput {
    shortcut: string;
    title?: string | null;
    body: string;
    sortOrder?: number;
}
export type UpdateQuickReplyInput = Partial<CreateQuickReplyInput> & { isActive?: boolean };

/** Pintasan aman: huruf kecil, angka, underscore (tanpa spasi/"/"). */
function slugShortcut(s: string): string {
    return (s || '')
        .toLowerCase()
        .trim()
        .replace(/^\/+/, '')
        .replace(/[^a-z0-9_\s]/g, '')
        .replace(/\s+/g, '_')
        .slice(0, 60);
}

@Injectable()
export class WaQuickReplyService {
    constructor(private readonly prisma: PrismaService) {}

    list() {
        return this.prisma.waQuickReply.findMany({ orderBy: [{ sortOrder: 'asc' }, { shortcut: 'asc' }] });
    }

    async create(input: CreateQuickReplyInput, userId?: number) {
        const shortcut = slugShortcut(input.shortcut || input.title || '');
        if (!shortcut) throw new BadRequestException('Pintasan wajib diisi');
        if (!input.body?.trim()) throw new BadRequestException('Isi pesan wajib diisi');
        if (await this.prisma.waQuickReply.count({ where: { shortcut } })) {
            throw new BadRequestException(`Pintasan "/${shortcut}" sudah dipakai`);
        }
        return this.prisma.waQuickReply.create({
            data: {
                shortcut,
                title: input.title?.trim() || null,
                body: input.body.trim(),
                sortOrder: input.sortOrder ?? 0,
                createdById: userId ?? null,
            },
        });
    }

    async update(id: number, input: UpdateQuickReplyInput) {
        const cur = await this.prisma.waQuickReply.findUnique({ where: { id } });
        if (!cur) throw new BadRequestException('Pesan cepat tidak ditemukan');
        let shortcut = cur.shortcut;
        if (input.shortcut !== undefined) {
            shortcut = slugShortcut(input.shortcut);
            if (!shortcut) throw new BadRequestException('Pintasan wajib diisi');
            if (shortcut !== cur.shortcut && (await this.prisma.waQuickReply.count({ where: { shortcut } }))) {
                throw new BadRequestException(`Pintasan "/${shortcut}" sudah dipakai`);
            }
        }
        return this.prisma.waQuickReply.update({
            where: { id },
            data: {
                shortcut,
                ...(input.title !== undefined ? { title: input.title?.trim() || null } : {}),
                ...(input.body !== undefined ? { body: input.body.trim() } : {}),
                ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
                ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
            },
        });
    }

    async remove(id: number) {
        await this.prisma.waQuickReply.delete({ where: { id } });
        return { ok: true };
    }
}
