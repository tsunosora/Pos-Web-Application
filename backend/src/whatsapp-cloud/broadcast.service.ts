import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CloudApiService } from './cloud-api.service';

export interface SegmentDef {
    onlyLinked?: boolean;     // hanya kontak yg tertaut Lead/Customer
    leadStatus?: string;      // filter status lead (mis. CLOSED_WON)
}
export interface VariableMapItem {
    source: 'profileName' | 'static';
    value?: string;
}
export interface CreateBroadcastInput {
    name: string;
    channelId: number;
    templateId: number;
    segment?: SegmentDef;
    variableMap?: VariableMapItem[];
    scheduledAt?: string | null;
}

@Injectable()
export class BroadcastService {
    private readonly logger = new Logger(BroadcastService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly cloud: CloudApiService,
    ) {}

    private get ratePerSec(): number {
        const n = parseInt(process.env.WA_BROADCAST_RATE_PER_SEC || '10', 10);
        return Number.isFinite(n) && n > 0 ? n : 10;
    }

    /** Diekstrak agar bisa di-mock di test (hindari delay nyata). */
    protected sleep(ms: number): Promise<void> {
        return new Promise((r) => setTimeout(r, ms));
    }

    /** Bangun WHERE kontak dari definisi segmen. Opt-out SELALU dikecualikan. */
    buildContactWhere(segment?: SegmentDef): Prisma.WaContactWhereInput {
        const where: Prisma.WaContactWhereInput = { optedOut: false };
        const seg = segment || {};
        if (seg.onlyLinked) where.OR = [{ leadId: { not: null } }, { customerId: { not: null } }];
        if (seg.leadStatus) where.lead = { is: { status: seg.leadStatus as any } };
        return where;
    }

    resolveSegment(segment?: SegmentDef) {
        return this.prisma.waContact.findMany({
            where: this.buildContactWhere(segment),
            select: { id: true, waId: true, profileName: true },
        });
    }

    async preview(segment?: SegmentDef) {
        const count = await this.prisma.waContact.count({ where: this.buildContactWhere(segment) });
        return { count };
    }

    list() {
        return this.prisma.waBroadcast.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                channel: { select: { id: true, label: true } },
                template: { select: { id: true, name: true, status: true } },
            },
        });
    }

    async create(input: CreateBroadcastInput, userId?: number) {
        if (!input.name?.trim()) throw new BadRequestException('Nama broadcast wajib diisi');
        const template = await this.prisma.waTemplate.findUnique({ where: { id: input.templateId } });
        if (!template) throw new NotFoundException('Template tidak ditemukan');
        if (template.status !== 'APPROVED') {
            throw new ConflictException('Template harus berstatus APPROVED sebelum dipakai broadcast');
        }
        const channel = await this.prisma.waChannel.findUnique({ where: { id: input.channelId } });
        if (!channel) throw new NotFoundException('Channel tidak ditemukan');

        const contacts = await this.resolveSegment(input.segment);
        const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
        const broadcast = await this.prisma.waBroadcast.create({
            data: {
                name: input.name.trim(),
                channelId: input.channelId,
                templateId: input.templateId,
                status: scheduledAt ? 'SCHEDULED' : 'DRAFT',
                scheduledAt,
                segmentJson: (input.segment as unknown as Prisma.InputJsonValue) ?? Prisma.JsonNull,
                variableMapJson: (input.variableMap as unknown as Prisma.InputJsonValue) ?? Prisma.JsonNull,
                totalCount: contacts.length,
                createdById: userId ?? null,
            },
        });
        if (contacts.length) {
            await this.prisma.waBroadcastRecipient.createMany({
                data: contacts.map((c) => ({
                    broadcastId: broadcast.id,
                    contactId: c.id,
                    waId: c.waId,
                    status: 'PENDING' as const,
                })),
                skipDuplicates: true,
            });
        }
        return broadcast;
    }

    /** Susun body parameters template per kontak dari variableMap. */
    buildComponents(variableMap: VariableMapItem[], contact: { profileName: string | null }): any[] {
        if (!variableMap?.length) return [];
        const parameters = variableMap.map((m) => {
            const text = m.source === 'profileName' ? contact.profileName || '' : m.value || '';
            return { type: 'text', text: text || '-' };
        });
        return [{ type: 'body', parameters }];
    }

    /** Jalankan (klaim atomik lalu proses di background). */
    async run(id: number) {
        const claimed = await this.prisma.waBroadcast.updateMany({
            where: { id, status: { in: ['DRAFT', 'SCHEDULED', 'PAUSED'] } },
            data: { status: 'RUNNING', startedAt: new Date() },
        });
        if (claimed.count === 0) {
            throw new ConflictException('Broadcast tidak dalam status yang bisa dijalankan');
        }
        // Background — tidak memblok respons HTTP.
        void this.process(id).catch((e) => this.logger.error(`Broadcast ${id} gagal: ${(e as Error).message}`));
        return { ok: true, status: 'RUNNING' };
    }

    /** Loop kirim ke recipient PENDING dgn throttle; berhenti bila pause/cancel. */
    async process(id: number): Promise<void> {
        const b = await this.prisma.waBroadcast.findUnique({
            where: { id },
            include: { channel: true, template: true },
        });
        if (!b) return;
        const variableMap: VariableMapItem[] = Array.isArray(b.variableMapJson) ? (b.variableMapJson as any) : [];
        const delayMs = Math.floor(1000 / this.ratePerSec);

        for (;;) {
            const cur = await this.prisma.waBroadcast.findUnique({ where: { id }, select: { status: true } });
            if (!cur || cur.status !== 'RUNNING') break; // dipause/dibatalkan
            const r = await this.prisma.waBroadcastRecipient.findFirst({
                where: { broadcastId: id, status: 'PENDING' },
                orderBy: { id: 'asc' },
            });
            if (!r) break; // habis

            const contact = await this.prisma.waContact.findUnique({ where: { id: r.contactId } });
            if (!contact || contact.optedOut) {
                await this.prisma.waBroadcastRecipient.update({
                    where: { id: r.id },
                    data: { status: 'SKIPPED', errorMessage: 'kontak opt-out' },
                });
                continue;
            }
            try {
                const components = this.buildComponents(variableMap, contact);
                const { waMessageId } = await this.cloud.sendTemplate(
                    b.channel.phoneNumberId, r.waId, b.template.name, b.template.language, components,
                );
                await this.prisma.waBroadcastRecipient.update({
                    where: { id: r.id },
                    data: { status: 'SENT', waMessageId, sentAt: new Date() },
                });
            } catch (e) {
                await this.prisma.waBroadcastRecipient.update({
                    where: { id: r.id },
                    data: { status: 'FAILED', errorMessage: (e as Error).message },
                });
            }
            if (delayMs) await this.sleep(delayMs);
        }
        await this.finalize(id);
    }

    private async finalize(id: number) {
        const [sentCount, failedCount, pending] = await Promise.all([
            this.prisma.waBroadcastRecipient.count({ where: { broadcastId: id, status: { in: ['SENT', 'DELIVERED', 'READ'] } } }),
            this.prisma.waBroadcastRecipient.count({ where: { broadcastId: id, status: 'FAILED' } }),
            this.prisma.waBroadcastRecipient.count({ where: { broadcastId: id, status: 'PENDING' } }),
        ]);
        const cur = await this.prisma.waBroadcast.findUnique({ where: { id }, select: { status: true } });
        const done = cur?.status === 'RUNNING' && pending === 0;
        await this.prisma.waBroadcast.update({
            where: { id },
            data: {
                sentCount,
                failedCount,
                ...(done ? { status: 'COMPLETED', completedAt: new Date() } : {}),
            },
        });
    }

    async pause(id: number) {
        const res = await this.prisma.waBroadcast.updateMany({ where: { id, status: 'RUNNING' }, data: { status: 'PAUSED' } });
        if (res.count === 0) throw new ConflictException('Hanya broadcast RUNNING yang bisa dijeda');
        return { ok: true, status: 'PAUSED' };
    }

    resume(id: number) {
        return this.run(id); // klaim ulang dari PAUSED
    }

    async cancel(id: number) {
        const res = await this.prisma.waBroadcast.updateMany({
            where: { id, status: { in: ['DRAFT', 'SCHEDULED', 'RUNNING', 'PAUSED'] } },
            data: { status: 'CANCELLED' },
        });
        if (res.count === 0) throw new ConflictException('Broadcast sudah selesai/dibatalkan');
        return { ok: true, status: 'CANCELLED' };
    }

    async report(id: number) {
        const broadcast = await this.prisma.waBroadcast.findUnique({
            where: { id },
            include: { channel: { select: { label: true } }, template: { select: { name: true } } },
        });
        if (!broadcast) throw new NotFoundException('Broadcast tidak ditemukan');
        const grouped = await this.prisma.waBroadcastRecipient.groupBy({
            by: ['status'],
            where: { broadcastId: id },
            _count: true,
        });
        const counts: Record<string, number> = {};
        for (const g of grouped) counts[g.status] = g._count;
        return { broadcast, counts };
    }

    /** Cron: jalankan broadcast terjadwal yang sudah waktunya (tiap menit). */
    @Cron('0 * * * * *')
    async sweepScheduled() {
        const due = await this.prisma.waBroadcast.findMany({
            where: { status: 'SCHEDULED', scheduledAt: { lte: new Date() } },
            select: { id: true },
        });
        for (const b of due) {
            try {
                await this.run(b.id);
            } catch (e) {
                this.logger.warn(`Gagal auto-run broadcast ${b.id}: ${(e as Error).message}`);
            }
        }
    }
}
