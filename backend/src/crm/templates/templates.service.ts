import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export type TemplateCategory =
    | 'GREETING' | 'FU_LEAD' | 'PROGRESS_UPDATE' | 'AFTER_SALES' | 'REPEAT_ORDER' | 'CUSTOM';

export interface RenderContext {
    leadId?: number;
    customerId?: number;
    salesOrderId?: number;
    extra?: Record<string, string | number>;
}

@Injectable()
export class TemplatesService {
    constructor(private readonly prisma: PrismaService) {}

    async list(category?: string, activeOnly = false) {
        return this.prisma.messageTemplate.findMany({
            where: {
                ...(category ? { category } : {}),
                ...(activeOnly ? { isActive: true } : {}),
            },
            orderBy: [{ category: 'asc' }, { name: 'asc' }],
        });
    }

    async detail(id: number) {
        const t = await this.prisma.messageTemplate.findUnique({ where: { id } });
        if (!t) throw new NotFoundException('Template tidak ditemukan');
        return t;
    }

    async create(data: { name: string; category: string; bodyTemplate: string; isActive?: boolean }) {
        if (!data.name || !data.bodyTemplate) {
            throw new BadRequestException('Nama dan body template wajib diisi');
        }
        return this.prisma.messageTemplate.create({
            data: {
                name: data.name,
                category: data.category || 'CUSTOM',
                bodyTemplate: data.bodyTemplate,
                isActive: data.isActive ?? true,
            },
        });
    }

    async update(id: number, data: { name?: string; category?: string; bodyTemplate?: string; isActive?: boolean }) {
        await this.detail(id);
        return this.prisma.messageTemplate.update({
            where: { id },
            data: {
                ...(data.name !== undefined ? { name: data.name } : {}),
                ...(data.category !== undefined ? { category: data.category } : {}),
                ...(data.bodyTemplate !== undefined ? { bodyTemplate: data.bodyTemplate } : {}),
                ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
            },
        });
    }

    async remove(id: number) {
        await this.detail(id);
        await this.prisma.messageTemplate.delete({ where: { id } });
        return { ok: true };
    }

    /** Render template dengan placeholder dari context. Tidak throw kalau placeholder kosong — sisakan blank. */
    async render(id: number, ctx: RenderContext): Promise<{ template: any; rendered: string; placeholders: Record<string, string> }> {
        const tpl = await this.detail(id);
        const placeholders = await this.resolvePlaceholders(ctx);
        let rendered = tpl.bodyTemplate;
        for (const [key, value] of Object.entries(placeholders)) {
            const re = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gi');
            rendered = rendered.replace(re, value);
        }
        return { template: tpl, rendered, placeholders };
    }

    private async resolvePlaceholders(ctx: RenderContext): Promise<Record<string, string>> {
        const ph: Record<string, string> = {
            // default fallback supaya placeholder tidak crash
            name: '',
            phone: '',
            soNumber: '',
            status: '',
            estimatedDays: '',
            monthsSinceLastOrder: '',
            ...(ctx.extra as Record<string, string> | undefined ?? {}),
        };

        if (ctx.leadId) {
            const lead = await this.prisma.lead.findUnique({ where: { id: ctx.leadId } });
            if (lead) {
                ph.name = lead.name;
                ph.phone = lead.phone || '';
                ph.status = lead.status;
            }
        }
        if (ctx.customerId) {
            const c = await this.prisma.customer.findUnique({
                where: { id: ctx.customerId },
                include: { salesOrders: { orderBy: { createdAt: 'desc' }, take: 1 } },
            });
            if (c) {
                ph.name = c.name;
                ph.phone = c.phone || '';
                if (c.salesOrders[0]?.createdAt) {
                    const months = Math.floor((Date.now() - new Date(c.salesOrders[0].createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30));
                    ph.monthsSinceLastOrder = String(months);
                }
            }
        }
        if (ctx.salesOrderId) {
            const so = await this.prisma.salesOrder.findUnique({ where: { id: ctx.salesOrderId } });
            if (so) {
                ph.soNumber = so.soNumber;
                ph.status = so.status;
                if (so.deadline) {
                    const days = Math.ceil((new Date(so.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    ph.estimatedDays = String(Math.max(0, days));
                }
            }
        }

        return ph;
    }

    /** Seed default templates idempotent. */
    async seedDefaults() {
        const defaults = [
            {
                name: 'Greeting Lead Baru',
                category: 'GREETING',
                bodyTemplate: `Halo kak {{name}} 🙌\nTerima kasih sudah menghubungi VolikoPrint.\nBoleh dibantu untuk kebutuhan cetak/jersey apa kak?\n(Banner / Paper print / Jersey / Komunitas / Event / dll)`,
            },
            {
                name: 'Follow Up Lead Hari ke-3',
                category: 'FU_LEAD',
                bodyTemplate: `Halo kak {{name}} 🙏\nMau follow up kebutuhan cetak/jersey-nya kemarin. Apakah ada yang bisa kami bantu lebih lanjut?\nKalau ada pertanyaan tentang bahan, harga, atau timeline, langsung tanya saja ya kak 🙌`,
            },
            {
                name: 'Update Progress: Masuk Printing',
                category: 'PROGRESS_UPDATE',
                bodyTemplate: `Update untuk kak {{name}} 🖨️\nPesanan {{soNumber}} sudah masuk proses *printing*.\nEstimasi siap: ~{{estimatedDays}} hari lagi.\nKami akan update lagi saat masuk tahap berikutnya 🙌`,
            },
            {
                name: 'After Sales (Cek Penerimaan)',
                category: 'AFTER_SALES',
                bodyTemplate: `Halo kak {{name}} 🙌\nPesanannya sudah diterima dengan baik ya?\nSemoga hasil cetakannya cocok dan tim/komunitas suka 🙏\nKalau berkenan, boleh kami minta foto pakai atau testimoni singkat untuk kami pajang? Sangat membantu untuk semangat tim kami.\nTerima kasih banyak kak!`,
            },
            {
                name: 'Repeat Order Nudge',
                category: 'REPEAT_ORDER',
                bodyTemplate: `Halo kak {{name}} 👋\nSudah {{monthsSinceLastOrder}} bulan ya sejak order terakhir di VolikoPrint.\nKalau ada agenda baru — turnamen, event, atau seragam — kami siap bantu dengan harga & timeline terbaik untuk customer langganan 🙏\nLangsung balas chat ini kalau ada yang mau dibahas ya kak 🙌`,
            },
        ];

        let inserted = 0;
        for (const t of defaults) {
            const exists = await this.prisma.messageTemplate.findFirst({ where: { name: t.name } });
            if (!exists) {
                await this.prisma.messageTemplate.create({ data: t });
                inserted++;
            }
        }
        return { inserted, total: defaults.length };
    }
}
