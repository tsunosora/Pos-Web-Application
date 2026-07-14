import {
    ForbiddenException,
    Injectable,
    NotFoundException,
    ServiceUnavailableException,
} from '@nestjs/common';
import { randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { BranchContext } from '../common/branch-context.decorator';
import { assertBranchAccess } from '../common/branch-where.helper';
import { PrinterRelayRegistry, type AckResult, type RelayJob } from './printer-relay.registry';

// Berapa lama kasir menunggu konfirmasi cetak dari agen sebelum dianggap gagal.
const ACK_TIMEOUT_MS = 15_000;

export interface CreateDevicePayload {
    branchId: number;
    name: string;
    connection?: string; // "usb" | "bluetooth"
    target?: string | null;
}

export interface UpdateDevicePayload {
    name?: string;
    connection?: string;
    target?: string | null;
    isActive?: boolean;
}

@Injectable()
export class PrinterRelayService {
    constructor(
        private prisma: PrismaService,
        private registry: PrinterRelayRegistry,
    ) { }

    private get devices() {
        return (this.prisma as any).printerDevice;
    }

    // "usb" (COM port) | "bluetooth" (RFCOMM/COM) | "windows" (spooler RAW by name)
    private normalizeConnection(connection?: string): string {
        if (connection === 'bluetooth') return 'bluetooth';
        if (connection === 'windows') return 'windows';
        return 'usb';
    }

    private modeFor(connection: string): string {
        if (connection === 'bluetooth') return 'rfcomm';
        if (connection === 'windows') return 'spooler';
        return 'com';
    }

    private shape(dev: any) {
        return {
            id: dev.id,
            branchId: dev.branchId,
            name: dev.name,
            connection: dev.connection,
            mode: dev.mode,
            target: dev.target ?? null,
            isActive: dev.isActive,
            token: dev.token, // ditampilkan ke owner untuk setup agen
            online: this.registry.isOnline(dev.branchId),
            lastSeenAt: dev.lastSeenAt ?? null,
        };
    }

    // ── Agen (auth via token perangkat) ─────────────────────────────────────
    async deviceByToken(token: string | undefined) {
        if (!token) return null;
        const dev = await this.devices.findUnique({ where: { token } });
        if (!dev || !dev.isActive) return null;
        return dev;
    }

    async touchLastSeen(id: number): Promise<void> {
        try {
            await this.devices.update({ where: { id }, data: { lastSeenAt: new Date() } });
        } catch {
            /* non-fatal */
        }
    }

    // ── Kasir: kirim job & tunggu konfirmasi ────────────────────────────────
    async submitAndWait(branchId: number, dataBase64: string): Promise<AckResult> {
        if (!dataBase64) {
            throw new ServiceUnavailableException('Data struk kosong.');
        }
        if (!this.registry.isOnline(branchId)) {
            throw new ServiceUnavailableException(
                'Printer server cabang ini sedang offline. Nyalakan agen di komputer utama, atau pakai cetak Bluetooth/Browser.',
            );
        }
        const job: RelayJob = { jobId: randomUUID(), dataBase64, createdAt: Date.now() };
        const ackPromise = this.registry.waitForAck(job.jobId, ACK_TIMEOUT_MS);
        const delivered = this.registry.submitJob(branchId, job);
        if (!delivered) {
            this.registry.cancelAck(job.jobId);
            throw new ServiceUnavailableException('Printer server cabang ini sedang offline.');
        }
        const ack = await ackPromise;
        if (!ack.ok) {
            throw new ServiceUnavailableException(ack.error || 'Gagal mencetak di agen printer.');
        }
        return ack;
    }

    statusFor(branchId: number) {
        return {
            branchId,
            online: this.registry.isOnline(branchId),
            lastSeenAt: this.registry.lastSeenAt(branchId),
        };
    }

    // ── Manajemen perangkat (Owner/SuperAdmin) ──────────────────────────────
    private assertOwner(ctx: BranchContext): void {
        if (!ctx.isOwner) {
            throw new ForbiddenException('Hanya Owner yang boleh mengelola printer.');
        }
    }

    async list(ctx: BranchContext, branchId?: number) {
        // Owner: filter by `branchId` (query) → lalu ctx.branchId (header) → else semua.
        // Staff: dikunci ke cabangnya sendiri.
        const where: any = {};
        if (!ctx.isOwner) {
            where.branchId = ctx.userBranchId;
        } else if (branchId != null && !Number.isNaN(branchId)) {
            where.branchId = branchId;
        } else if (ctx.branchId != null) {
            where.branchId = ctx.branchId;
        }
        const rows = await this.devices.findMany({ where, orderBy: { id: 'asc' } });
        return rows.map((d: any) => this.shape(d));
    }

    async create(ctx: BranchContext, payload: CreateDevicePayload) {
        this.assertOwner(ctx);
        const branchId = Number(payload.branchId);
        if (!branchId) throw new NotFoundException('Cabang wajib dipilih.');
        const branch = await this.prisma.companyBranch.findUnique({ where: { id: branchId } });
        if (!branch) throw new NotFoundException('Cabang tidak ditemukan.');

        const connection = this.normalizeConnection(payload.connection);
        const dev = await this.devices.create({
            data: {
                branchId,
                name: (payload.name || 'Printer').trim().slice(0, 100),
                token: randomBytes(24).toString('hex'), // 48 char rahasia agen
                connection,
                mode: this.modeFor(connection),
                target: payload.target?.trim() || null,
            },
        });
        return this.shape(dev);
    }

    async update(ctx: BranchContext, id: number, payload: UpdateDevicePayload) {
        this.assertOwner(ctx);
        const dev = await this.devices.findUnique({ where: { id } });
        if (!dev) throw new NotFoundException('Printer tidak ditemukan.');
        assertBranchAccess(ctx, dev.branchId);

        const data: any = {};
        if (payload.name !== undefined) data.name = payload.name.trim().slice(0, 100);
        if (payload.target !== undefined) data.target = payload.target?.trim() || null;
        if (payload.isActive !== undefined) data.isActive = !!payload.isActive;
        if (payload.connection !== undefined) {
            const connection = this.normalizeConnection(payload.connection);
            data.connection = connection;
            data.mode = this.modeFor(connection);
        }
        const updated = await this.devices.update({ where: { id }, data });
        return this.shape(updated);
    }

    async rotateToken(ctx: BranchContext, id: number) {
        this.assertOwner(ctx);
        const dev = await this.devices.findUnique({ where: { id } });
        if (!dev) throw new NotFoundException('Printer tidak ditemukan.');
        const updated = await this.devices.update({
            where: { id },
            data: { token: randomBytes(24).toString('hex') },
        });
        return this.shape(updated);
    }

    async remove(ctx: BranchContext, id: number) {
        this.assertOwner(ctx);
        const dev = await this.devices.findUnique({ where: { id } });
        if (!dev) throw new NotFoundException('Printer tidak ditemukan.');
        await this.devices.delete({ where: { id } });
        return { ok: true };
    }
}
