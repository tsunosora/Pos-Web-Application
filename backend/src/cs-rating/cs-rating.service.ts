import {
    Injectable,
    NotFoundException,
    ConflictException,
    BadRequestException,
    HttpException,
    HttpStatus,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { randomBytes } from 'crypto';

const DEFAULT_QUESTION = 'Apakah Anda puas dengan pelayanan kami?';
const DEFAULT_THANKS = 'Terima kasih atas penilaian Anda!';

export interface CreateInviteDto {
    salesOrderId?: number;
    transactionId?: number;
    customerId?: number;
    branchId?: number;
    assignedCsId?: number;
}

export interface SubmitRatingDto {
    answer?: boolean;
    stars?: number;
    comment?: string;
    staffId?: number; // hanya untuk QR walk-in: CS/karyawan yang dipilih pelanggan (opsional)
}

// Anti-spam QR walk-in: maksimal N submit per IP per cabang dalam WINDOW.
const IP_WINDOW_MS = 5 * 60 * 1000;
const IP_MAX = 20;

export interface UpdateConfigDto {
    branchId?: number | null;
    question?: string;
    thankYouText?: string;
    isActive?: boolean;
}

@Injectable()
export class CsRatingService {
    constructor(private readonly prisma: PrismaService) {}

    // Peta anti-spam per IP+cabang (in-memory; reset saat restart — cukup untuk cegah flood).
    private ipHits = new Map<string, number[]>();

    private genToken(): string {
        // ~22 char base64url, muat di kolom VarChar(32)
        return randomBytes(16).toString('base64url');
    }

    /** Batasi flood submit walk-in dari satu IP ke satu cabang. Lempar 429 bila lewat batas. */
    private throttleIp(ip: string | undefined, branchId: number) {
        const key = `${ip || 'unknown'}|${branchId}`;
        const now = Date.now();
        const recent = (this.ipHits.get(key) || []).filter((t) => now - t < IP_WINDOW_MS);
        if (recent.length >= IP_MAX) {
            throw new HttpException(
                'Terlalu banyak penilaian dari koneksi ini. Coba lagi beberapa menit lagi.',
                HttpStatus.TOO_MANY_REQUESTS,
            );
        }
        recent.push(now);
        this.ipHits.set(key, recent);
        // Prune sesekali agar map tidak menggelembung.
        if (this.ipHits.size > 5000) {
            for (const [k, v] of this.ipHits) {
                if (!v.some((t) => now - t < IP_WINDOW_MS)) this.ipHits.delete(k);
            }
        }
    }

    /** Ambil config aktif: cabang cocok → global (branchId null) → default hardcoded. */
    async getActiveConfig(branchId?: number | null) {
        let cfg =
            branchId != null
                ? await this.prisma.csRatingConfig.findFirst({
                      where: { branchId, isActive: true },
                  })
                : null;
        if (!cfg) {
            cfg = await this.prisma.csRatingConfig.findFirst({
                where: { branchId: null, isActive: true },
            });
        }
        return {
            question: cfg?.question ?? DEFAULT_QUESTION,
            thankYouText: cfg?.thankYouText ?? DEFAULT_THANKS,
        };
    }

    /** Buat undangan penilaian. Idempoten per SO (kembalikan yang belum dijawab bila ada). */
    async createInvite(dto: CreateInviteDto) {
        let { customerId, assignedCsId, branchId, transactionId } = dto;
        let assignedCsName: string | null = null;
        let designerName: string | null = null;

        if (dto.salesOrderId) {
            const so = await this.prisma.salesOrder.findUnique({
                where: { id: dto.salesOrderId },
                include: {
                    customer: { include: { assignedCs: true } },
                    transaction: true,
                },
            });
            if (!so) throw new NotFoundException('SO tidak ditemukan');
            customerId = customerId ?? so.customerId ?? undefined;
            assignedCsId = assignedCsId ?? so.customer?.assignedCsId ?? undefined;
            assignedCsName = so.customer?.assignedCs?.name ?? null;
            designerName = so.designerName ?? null;
            transactionId = transactionId ?? so.transactionId ?? undefined;
            branchId = branchId ?? so.transaction?.branchId ?? undefined;

            // Idempoten: jika sudah ada undangan belum-dijawab untuk SO ini, pakai ulang.
            const existing = await this.prisma.csRatingResponse.findFirst({
                where: { salesOrderId: so.id, submittedAt: null },
            });
            if (existing) return existing;
        } else if (transactionId) {
            const tx = await this.prisma.transaction.findUnique({
                where: { id: transactionId },
            });
            if (!tx) throw new NotFoundException('Transaksi tidak ditemukan');
            branchId = branchId ?? tx.branchId ?? undefined;
        }

        // Lengkapi nama CS bila hanya id yang diketahui.
        if (assignedCsId && !assignedCsName) {
            const u = await this.prisma.user.findUnique({ where: { id: assignedCsId } });
            assignedCsName = u?.name ?? null;
        }

        const cfg = await this.getActiveConfig(branchId ?? null);

        return this.prisma.csRatingResponse.create({
            data: {
                token: this.genToken(),
                salesOrderId: dto.salesOrderId ?? null,
                transactionId: transactionId ?? null,
                customerId: customerId ?? null,
                assignedCsId: assignedCsId ?? null,
                assignedCsName,
                designerName,
                branchId: branchId ?? null,
                question: cfg.question,
            },
        });
    }

    /** Data untuk halaman publik. */
    async verifyToken(token: string) {
        const r = await this.prisma.csRatingResponse.findUnique({ where: { token } });
        if (!r) throw new NotFoundException('Link penilaian tidak valid');
        const cfg = await this.getActiveConfig(r.branchId);
        return {
            question: r.question,
            thankYouText: cfg.thankYouText,
            alreadySubmitted: r.submittedAt != null,
        };
    }

    /** Simpan jawaban pelanggan (sekali saja). */
    async submit(token: string, dto: SubmitRatingDto) {
        const r = await this.prisma.csRatingResponse.findUnique({ where: { token } });
        if (!r) throw new NotFoundException('Link penilaian tidak valid');
        if (r.submittedAt) throw new ConflictException('Penilaian sudah dikirim');

        const stars = Number(dto.stars);
        if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
            throw new BadRequestException('Bintang harus 1 sampai 5');
        }
        if (typeof dto.answer !== 'boolean') {
            throw new BadRequestException('Jawaban Ya/Tidak wajib diisi');
        }
        const comment = (dto.comment ?? '').toString().slice(0, 1000) || null;

        await this.prisma.csRatingResponse.update({
            where: { token },
            data: { answer: dto.answer, stars, comment, submittedAt: new Date() },
        });
        const cfg = await this.getActiveConfig(r.branchId);
        return { ok: true, thankYouText: cfg.thankYouText };
    }

    /** Poling per cabang (untuk QR/link statis di meja kasir — walk-in). */
    async getBranchPoll(branchId: number) {
        const branch = await this.prisma.companyBranch.findUnique({ where: { id: branchId } });
        if (!branch) throw new NotFoundException('Cabang tidak ditemukan');
        const cfg = await this.getActiveConfig(branchId);
        return { branchName: branch.name, question: cfg.question, thankYouText: cfg.thankYouText };
    }

    /** Daftar CS/karyawan cabang untuk dipilih pelanggan (walk-in). Owner dikecualikan. */
    async getBranchStaff(branchId: number) {
        const branch = await this.prisma.companyBranch.findUnique({ where: { id: branchId } });
        if (!branch) throw new NotFoundException('Cabang tidak ditemukan');
        const users = await this.prisma.user.findMany({
            where: {
                branchId,
                name: { not: null },
                role: { is: { name: { not: 'Owner' } } },
            },
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
        });
        return users;
    }

    /** Submit penilaian walk-in via QR cabang: buat + isi baris sekaligus (tanpa baris pending). */
    async submitBranch(branchId: number, dto: SubmitRatingDto, ip?: string) {
        const branch = await this.prisma.companyBranch.findUnique({ where: { id: branchId } });
        if (!branch) throw new NotFoundException('Cabang tidak ditemukan');

        this.throttleIp(ip, branchId);

        const stars = Number(dto.stars);
        if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
            throw new BadRequestException('Bintang harus 1 sampai 5');
        }
        if (typeof dto.answer !== 'boolean') {
            throw new BadRequestException('Jawaban Ya/Tidak wajib diisi');
        }
        const comment = (dto.comment ?? '').toString().slice(0, 1000) || null;

        // CS yang dipilih pelanggan (opsional). Validasi memang staff cabang ini.
        let assignedCsId: number | null = null;
        let assignedCsName: string | null = null;
        if (dto.staffId) {
            const staff = await this.prisma.user.findFirst({
                where: { id: Number(dto.staffId), branchId },
                select: { id: true, name: true },
            });
            if (staff) {
                assignedCsId = staff.id;
                assignedCsName = staff.name ?? null;
            }
        }

        const cfg = await this.getActiveConfig(branchId);

        await this.prisma.csRatingResponse.create({
            data: {
                token: this.genToken(),
                branchId,
                assignedCsId,
                assignedCsName,
                question: cfg.question,
                answer: dto.answer,
                stars,
                comment,
                submittedAt: new Date(),
            },
        });
        return { ok: true, thankYouText: cfg.thankYouText };
    }

    /** Ringkasan untuk owner: total, rata-rata bintang, %Ya, breakdown per petugas. */
    async summary(params: { branchId?: number; from?: string; to?: string } = {}) {
        // Batas hari: 'YYYY-MM-DD' → awal hari (00:00) untuk from, akhir hari (23:59:59.999) untuk to.
        // Tanpa ini, to=hari-ini jam 00:00 membuang semua penilaian yang masuk hari ini.
        const dayStart = (s: string) => new Date(s.length <= 10 ? `${s}T00:00:00` : s);
        const dayEnd = (s: string) => new Date(s.length <= 10 ? `${s}T23:59:59.999` : s);

        const where: any = { submittedAt: { not: null } };
        if (params.branchId) where.branchId = Number(params.branchId);
        if (params.from || params.to) {
            where.submittedAt = {
                not: null,
                ...(params.from ? { gte: dayStart(params.from) } : {}),
                ...(params.to ? { lte: dayEnd(params.to) } : {}),
            };
        }

        const rows = await this.prisma.csRatingResponse.findMany({
            where,
            select: {
                stars: true,
                answer: true,
                designerName: true,
                assignedCsName: true,
            },
        });

        const total = rows.length;
        const starSum = rows.reduce((s, r) => s + (r.stars ?? 0), 0);
        const yesCount = rows.filter((r) => r.answer === true).length;

        // Breakdown per petugas: prioritas designer (yang closing SO) → CS.
        const byPerson = new Map<
            string,
            { name: string; count: number; starSum: number; yes: number }
        >();
        for (const r of rows) {
            const name = r.assignedCsName || r.designerName || 'Umum';
            const g = byPerson.get(name) ?? { name, count: 0, starSum: 0, yes: 0 };
            g.count += 1;
            g.starSum += r.stars ?? 0;
            if (r.answer === true) g.yes += 1;
            byPerson.set(name, g);
        }
        const perPerson = [...byPerson.values()]
            .map((g) => ({
                name: g.name,
                count: g.count,
                avgStars: g.count ? +(g.starSum / g.count).toFixed(2) : 0,
                yesPercent: g.count ? Math.round((g.yes / g.count) * 100) : 0,
            }))
            .sort((a, b) => b.avgStars - a.avgStars);

        return {
            total,
            avgStars: total ? +(starSum / total).toFixed(2) : 0,
            yesPercent: total ? Math.round((yesCount / total) * 100) : 0,
            perPerson,
        };
    }

    /** Buat/ubah pertanyaan poling (per cabang atau global bila branchId null). */
    async upsertConfig(dto: UpdateConfigDto) {
        const branchId = dto.branchId ?? null;
        const existing = await this.prisma.csRatingConfig.findFirst({ where: { branchId } });
        const data: any = {};
        if (dto.question !== undefined) data.question = dto.question;
        if (dto.thankYouText !== undefined) data.thankYouText = dto.thankYouText;
        if (dto.isActive !== undefined) data.isActive = dto.isActive;

        if (existing) {
            return this.prisma.csRatingConfig.update({ where: { id: existing.id }, data });
        }
        return this.prisma.csRatingConfig.create({
            data: {
                branchId,
                question: dto.question ?? DEFAULT_QUESTION,
                thankYouText: dto.thankYouText ?? DEFAULT_THANKS,
                isActive: dto.isActive ?? true,
            },
        });
    }

    /** Config mentah (untuk editor owner) — kembalikan row nyata, bukan fallback. */
    async getConfigRow(branchId?: number | null) {
        return this.prisma.csRatingConfig.findFirst({ where: { branchId: branchId ?? null } });
    }
}
