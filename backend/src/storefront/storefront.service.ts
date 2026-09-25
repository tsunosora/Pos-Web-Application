import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Status lead yang boleh dipakai sebagai filter oleh website. */
export const STATUS_WEBSITE = ['NEW', 'FOLLOW_UP', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST'] as const;
export type StatusWebsite = (typeof STATUS_WEBSITE)[number];

/**
 * Baca-saja untuk website toko. SELALU dikunci `source = 'WEBSITE'` supaya order dari WhatsApp,
 * iklan, atau walk-in tidak pernah ikut terkirim ke luar. Kolom dipilih eksplisit: catatan
 * internal, harga modal, data staf/cabang, dan tautan nota TIDAK dikirim.
 */
const PILIH_LEAD = {
    id: true,
    name: true,
    phone: true,
    city: true,
    needs: true,
    status: true,
    createdAt: true,
    estimatedValue: true,
    items: {
        orderBy: { id: 'asc' as const },
        select: {
            description: true,
            quantity: true,
            unitPrice: true,
            widthCm: true,
            heightCm: true,
            unitType: true,
            productVariant: { select: { product: { select: { name: true } } } },
        },
    },
};

@Injectable()
export class StorefrontService {
    constructor(private readonly prisma: PrismaService) {}

    private get lead(): any {
        return (this.prisma as any).lead;
    }

    async daftar(params: { limit?: number; status?: string }) {
        const limit = Math.min(Math.max(Math.trunc(Number(params.limit) || 50), 1), 200);
        const status = (STATUS_WEBSITE as readonly string[]).includes(String(params.status))
            ? (params.status as StatusWebsite)
            : undefined;
        const where: any = { source: 'WEBSITE', ...(status ? { status } : {}) };
        const [items, total] = await Promise.all([
            this.lead.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit, select: PILIH_LEAD }),
            this.lead.count({ where }),
        ]);
        return { items, total };
    }

    async detail(id: number) {
        const lead = Number.isInteger(id) && id > 0
            ? await this.lead.findFirst({ where: { id, source: 'WEBSITE' }, select: PILIH_LEAD })
            : null;
        // Lead non-WEBSITE (mis. dari WhatsApp) sengaja dijawab 404, bukan 403 — website tidak
        // boleh bisa menebak lead mana yang ada di CRM.
        if (!lead) throw new NotFoundException('Order tidak ditemukan.');
        return lead;
    }

    async ringkasanStatus(): Promise<Record<string, number>> {
        const rows = await this.lead.groupBy({
            by: ['status'],
            where: { source: 'WEBSITE' },
            _count: { _all: true },
        });
        const hasil: Record<string, number> = {};
        for (const s of STATUS_WEBSITE) hasil[s] = 0;
        for (const r of rows as { status: string; _count: { _all: number } }[]) {
            if (r.status in hasil) hasil[r.status] = r._count._all;
        }
        return hasil;
    }
}
