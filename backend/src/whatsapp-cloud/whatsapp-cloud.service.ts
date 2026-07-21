import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CloudApiService } from './cloud-api.service';

export interface CreateChannelInput {
    label: string;
    phoneNumberId: string;
    wabaId: string;
    displayNumber?: string | null;
    branchId?: number | null;
}
export interface UpdateChannelInput {
    label?: string;
    wabaId?: string;
    displayNumber?: string | null;
    branchId?: number | null;
    isActive?: boolean;
}

export interface WaChannelHealth {
    id: number;
    label: string;
    phoneNumberId: string;
    branchId: number | null;
    ok: boolean;
    verifiedName?: string;
    displayNumber?: string;
    error?: string;
}

export interface WaHealthResult {
    enabled: boolean;
    channelCount: number;
    channels: WaChannelHealth[];
}

/**
 * Orkestrasi domain WhatsApp CRM. Fase 2: hanya health-check kredensial per
 * channel (verifikasi token + phone_number_id tanpa kirim pesan nyata).
 */
@Injectable()
export class WhatsappCloudService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly cloud: CloudApiService,
    ) {}

    /** Cek tiap channel aktif ke Graph API; error di-isolasi per channel. */
    async healthCheck(): Promise<WaHealthResult> {
        const channels = await this.prisma.waChannel.findMany({ where: { isActive: true } });
        const results = await Promise.all(
            channels.map(async (ch): Promise<WaChannelHealth> => {
                const base = { id: ch.id, label: ch.label, phoneNumberId: ch.phoneNumberId, branchId: ch.branchId };
                try {
                    const info = await this.cloud.getPhoneNumberInfo(ch.phoneNumberId);
                    return { ...base, ok: true, verifiedName: info.verifiedName, displayNumber: info.displayNumber };
                } catch (e) {
                    return { ...base, ok: false, error: (e as Error).message };
                }
            }),
        );
        return { enabled: this.cloud.enabled, channelCount: channels.length, channels: results };
    }

    // ─── Manajemen Channel (nomor per cabang) ────────────────────────────────

    listChannels() {
        return this.prisma.waChannel.findMany({
            orderBy: [{ isActive: 'desc' }, { label: 'asc' }],
            include: {
                branch: { select: { id: true, name: true } },
                _count: { select: { conversations: true } },
            },
        });
    }

    async createChannel(input: CreateChannelInput) {
        if (!input.label?.trim() || !input.phoneNumberId?.trim() || !input.wabaId?.trim()) {
            throw new BadRequestException('label, phoneNumberId, dan wabaId wajib diisi');
        }
        try {
            return await this.prisma.waChannel.create({
                data: {
                    label: input.label.trim(),
                    phoneNumberId: input.phoneNumberId.trim(),
                    wabaId: input.wabaId.trim(),
                    displayNumber: input.displayNumber?.trim() || null,
                    branchId: input.branchId ?? null,
                },
            });
        } catch (e) {
            throw this.mapChannelError(e);
        }
    }

    async updateChannel(id: number, input: UpdateChannelInput) {
        await this.getChannelOrThrow(id);
        try {
            return await this.prisma.waChannel.update({
                where: { id },
                data: {
                    ...(input.label !== undefined ? { label: input.label.trim() } : {}),
                    ...(input.wabaId !== undefined ? { wabaId: input.wabaId.trim() } : {}),
                    ...(input.displayNumber !== undefined ? { displayNumber: input.displayNumber?.trim() || null } : {}),
                    ...(input.branchId !== undefined ? { branchId: input.branchId ?? null } : {}),
                    ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
                },
            });
        } catch (e) {
            throw this.mapChannelError(e);
        }
    }

    /** Hapus channel HANYA bila belum punya percakapan (cegah cascade hapus chat).
     *  Kalau sudah ada, arahkan menonaktifkan (isActive=false). */
    async deleteChannel(id: number) {
        await this.getChannelOrThrow(id);
        const convCount = await this.prisma.waConversation.count({ where: { channelId: id } });
        if (convCount > 0) {
            throw new ConflictException(
                `Channel punya ${convCount} percakapan — nonaktifkan saja (jangan hapus) agar riwayat chat aman`,
            );
        }
        await this.prisma.waChannel.delete({ where: { id } });
        return { ok: true };
    }

    private async getChannelOrThrow(id: number) {
        const ch = await this.prisma.waChannel.findUnique({ where: { id } });
        if (!ch) throw new NotFoundException('Channel tidak ditemukan');
        return ch;
    }

    private mapChannelError(e: unknown): Error {
        if (e instanceof Prisma.PrismaClientKnownRequestError) {
            if (e.code === 'P2002') return new ConflictException('phone_number_id sudah terdaftar di channel lain');
            if (e.code === 'P2003') return new BadRequestException('Cabang (branchId) tidak ditemukan');
        }
        return e as Error;
    }
}
