import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, WaTemplateStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CloudApiService } from './cloud-api.service';

export interface CreateTemplateInput {
    name: string;
    language?: string;
    category?: string;
    bodyText: string;
    headerText?: string | null;
    footerText?: string | null;
    buttonsJson?: unknown;
    variableSample?: unknown;
}
export type UpdateTemplateInput = Partial<CreateTemplateInput>;

const META_STATUS_MAP: Record<string, WaTemplateStatus> = {
    APPROVED: 'APPROVED',
    PENDING: 'PENDING',
    IN_APPEAL: 'PENDING',
    PENDING_DELETION: 'DISABLED',
    REJECTED: 'REJECTED',
    PAUSED: 'PAUSED',
    FLAGGED: 'PAUSED',
    DISABLED: 'DISABLED',
};

/** Nama template Meta: hanya huruf kecil, angka, underscore. */
export function normalizeTemplateName(raw: string): string {
    return (raw || '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9_\s]/g, '')
        .replace(/\s+/g, '_')
        .slice(0, 120);
}

function mapMetaStatus(s: string | undefined): WaTemplateStatus {
    return META_STATUS_MAP[(s || '').toUpperCase()] ?? 'PENDING';
}

@Injectable()
export class TemplatesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly cloud: CloudApiService,
    ) {}

    list() {
        return this.prisma.waTemplate.findMany({ orderBy: [{ status: 'asc' }, { name: 'asc' }] });
    }

    async getOrThrow(id: number) {
        const t = await this.prisma.waTemplate.findUnique({ where: { id } });
        if (!t) throw new NotFoundException('Template tidak ditemukan');
        return t;
    }

    async create(input: CreateTemplateInput, userId?: number) {
        const name = normalizeTemplateName(input.name);
        if (!name) throw new BadRequestException('Nama template wajib (huruf kecil/angka/underscore)');
        if (!input.bodyText?.trim()) throw new BadRequestException('Isi body template wajib diisi');
        try {
            return await this.prisma.waTemplate.create({
                data: {
                    name,
                    language: input.language?.trim() || 'id',
                    category: (input.category || 'UTILITY').toUpperCase(),
                    bodyText: input.bodyText,
                    headerText: input.headerText?.trim() || null,
                    footerText: input.footerText?.trim() || null,
                    buttonsJson: (input.buttonsJson as Prisma.InputJsonValue) ?? Prisma.JsonNull,
                    variableSample: (input.variableSample as Prisma.InputJsonValue) ?? Prisma.JsonNull,
                    status: 'DRAFT',
                    createdById: userId ?? null,
                },
            });
        } catch (e) {
            if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
                throw new ConflictException('Template dengan nama + bahasa itu sudah ada');
            }
            throw e;
        }
    }

    /** Edit hanya boleh saat DRAFT/REJECTED (yg sudah APPROVED tak bisa diubah di Meta). */
    async update(id: number, input: UpdateTemplateInput) {
        const t = await this.getOrThrow(id);
        if (t.status === 'APPROVED' || t.status === 'PENDING') {
            throw new ConflictException('Template PENDING/APPROVED tak bisa diedit — buat versi baru');
        }
        return this.prisma.waTemplate.update({
            where: { id },
            data: {
                ...(input.name !== undefined ? { name: normalizeTemplateName(input.name) } : {}),
                ...(input.language !== undefined ? { language: input.language.trim() || 'id' } : {}),
                ...(input.category !== undefined ? { category: input.category.toUpperCase() } : {}),
                ...(input.bodyText !== undefined ? { bodyText: input.bodyText } : {}),
                ...(input.headerText !== undefined ? { headerText: input.headerText?.trim() || null } : {}),
                ...(input.footerText !== undefined ? { footerText: input.footerText?.trim() || null } : {}),
                ...(input.buttonsJson !== undefined
                    ? { buttonsJson: (input.buttonsJson as Prisma.InputJsonValue) ?? Prisma.JsonNull }
                    : {}),
                ...(input.variableSample !== undefined
                    ? { variableSample: (input.variableSample as Prisma.InputJsonValue) ?? Prisma.JsonNull }
                    : {}),
            },
        });
    }

    async remove(id: number) {
        await this.getOrThrow(id);
        await this.prisma.waTemplate.delete({ where: { id } });
        return { ok: true };
    }

    /** Susun array components format Meta dari field template. */
    buildComponents(t: {
        bodyText: string;
        headerText: string | null;
        footerText: string | null;
        buttonsJson: unknown;
        variableSample: unknown;
    }): any[] {
        const comps: any[] = [];
        if (t.headerText) comps.push({ type: 'HEADER', format: 'TEXT', text: t.headerText });
        const body: any = { type: 'BODY', text: t.bodyText };
        const sample = Array.isArray(t.variableSample) ? t.variableSample : null;
        if (sample && sample.length) body.example = { body_text: [sample.map((v) => String(v))] };
        comps.push(body);
        if (t.footerText) comps.push({ type: 'FOOTER', text: t.footerText });
        if (Array.isArray(t.buttonsJson) && t.buttonsJson.length) {
            comps.push({ type: 'BUTTONS', buttons: t.buttonsJson });
        }
        return comps;
    }

    /** Ajukan template ke Meta lewat WABA channel terpilih → status PENDING. */
    async submit(id: number, channelId: number) {
        const t = await this.getOrThrow(id);
        const ch = await this.prisma.waChannel.findUnique({ where: { id: channelId } });
        if (!ch) throw new NotFoundException('Channel tidak ditemukan');
        const res = await this.cloud.createTemplate(ch.wabaId, {
            name: t.name,
            language: t.language,
            category: t.category,
            components: this.buildComponents(t),
        });
        return this.prisma.waTemplate.update({
            where: { id },
            data: {
                status: mapMetaStatus(res.status),
                metaTemplateId: res.id ?? null,
                submittedWabaId: ch.wabaId,
                rejectedReason: null,
            },
        });
    }

    /** Sinkron status semua template dari Meta (WABA channel terpilih). */
    async syncFromMeta(channelId: number) {
        const ch = await this.prisma.waChannel.findUnique({ where: { id: channelId } });
        if (!ch) throw new NotFoundException('Channel tidak ditemukan');
        const remote = await this.cloud.listTemplates(ch.wabaId);
        let updated = 0;
        for (const m of remote) {
            const res = await this.prisma.waTemplate.updateMany({
                where: { name: m.name, language: m.language },
                data: {
                    status: mapMetaStatus(m.status),
                    metaTemplateId: m.id ?? undefined,
                    rejectedReason: m.rejected_reason ?? null,
                    submittedWabaId: ch.wabaId,
                },
            });
            updated += res.count;
        }
        return { fetched: remote.length, updated };
    }
}
