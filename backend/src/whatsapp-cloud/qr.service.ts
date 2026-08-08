import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateQrInput {
    name: string;
    code?: string;
    channelId?: number | null;
    source?: string;
    sourceDetail?: string | null;
    prefillText?: string;
}

/** Slug kode aman untuk marker #kode di pesan (huruf kecil + angka). */
function slugCode(s: string): string {
    return (s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '').slice(0, 24) || 'qr';
}

@Injectable()
export class WaQrService {
    constructor(private readonly prisma: PrismaService) {}

    list() {
        return this.prisma.waQrLink.findMany({ orderBy: { createdAt: 'desc' } });
    }

    /** Pastikan pesan memuat #kode (marker atribusi). */
    private withMarker(text: string, code: string): string {
        const t = (text || '').trim();
        return t.includes(`#${code}`) ? t : `${t} #${code}`.trim();
    }

    async create(input: CreateQrInput) {
        if (!input.name?.trim()) throw new BadRequestException('Nama QR wajib diisi');
        const base = slugCode(input.code || input.name);
        let code = base;
        let i = 1;
        while (await this.prisma.waQrLink.count({ where: { code } })) code = `${base}${i++}`;
        return this.prisma.waQrLink.create({
            data: {
                name: input.name.trim(),
                code,
                channelId: input.channelId ?? null,
                source: (input.source || 'CUSTOM').toUpperCase(),
                sourceDetail: input.sourceDetail?.trim() || null,
                prefillText: this.withMarker(input.prefillText || '', code),
                isActive: true,
            },
        });
    }

    async update(id: number, input: Partial<CreateQrInput> & { isActive?: boolean }) {
        const cur = await this.prisma.waQrLink.findUnique({ where: { id } });
        if (!cur) throw new BadRequestException('QR tidak ditemukan');
        return this.prisma.waQrLink.update({
            where: { id },
            data: {
                ...(input.name !== undefined ? { name: input.name.trim() } : {}),
                ...(input.channelId !== undefined ? { channelId: input.channelId } : {}),
                ...(input.source !== undefined ? { source: (input.source || 'CUSTOM').toUpperCase() } : {}),
                ...(input.sourceDetail !== undefined ? { sourceDetail: input.sourceDetail?.trim() || null } : {}),
                ...(input.prefillText !== undefined ? { prefillText: this.withMarker(input.prefillText, cur.code) } : {}),
                ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
            },
        });
    }

    async remove(id: number) {
        await this.prisma.waQrLink.delete({ where: { id } });
        return { ok: true };
    }
}
