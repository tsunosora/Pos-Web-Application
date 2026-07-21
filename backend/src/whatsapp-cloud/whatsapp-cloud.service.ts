import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudApiService } from './cloud-api.service';

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
}
