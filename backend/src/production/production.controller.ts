import { Controller, Get, Post, Body, Param, ParseIntPipe, Query, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';
import { ProductionService } from './production.service';
import { ClickCountingService } from '../click-counting/click-counting.service';
import { compressImage } from '../common/utils/compress-image.util';
import type { BranchContext } from '../common/branch-context.decorator';

// Folder upload foto counter (sama dengan yang dipakai click-counting admin)
const METER_DIR = './public/uploads';
try { fs.mkdirSync(METER_DIR, { recursive: true }); } catch { /* ignore */ }

const randomHex = () => Array(32).fill(null).map(() => Math.round(Math.random() * 16).toString(16)).join('');

/** Build BranchContext fake untuk endpoint public (operator /cetak — tidak punya JWT). */
function fakeOperatorCtx(branchId: number): BranchContext {
    return {
        branchId,
        isOwner: false,
        userBranchId: branchId,
        roleName: 'OPERATOR',
    };
}

// All endpoints are public (no JWT) — gated by operator PIN on client side
@Controller('production')
export class ProductionController {
    constructor(
        private readonly productionService: ProductionService,
        private readonly clickCounting: ClickCountingService,
    ) {}

    @Get('jobs')
    getJobs(
        @Query('status') status?: string,
        @Query('priority') priority?: string,
        @Query('branchId') branchId?: string,
    ) {
        return this.productionService.getJobs(status, priority, branchId ? parseInt(branchId) : undefined);
    }

    @Get('rolls')
    getRolls(@Query('branchId') branchId?: string) {
        return this.productionService.getRolls(branchId ? parseInt(branchId) : undefined);
    }

    @Get('stats')
    getStats(@Query('branchId') branchId?: string) {
        return this.productionService.getStats(branchId ? parseInt(branchId) : undefined);
    }

    @Post('pin/verify')
    verifyPin(@Body('pin') pin: string, @Body('branchId') branchId?: number) {
        return this.productionService.verifyPin(pin, branchId);
    }

    @Post('jobs/:id/start')
    startJob(
        @Param('id', ParseIntPipe) id: number,
        @Body() data: { rollVariantId?: number; usedWaste: boolean; rollAreaM2?: number; operatorNote?: string },
    ) {
        return this.productionService.startJob(id, data);
    }

    @Post('jobs/:id/complete')
    completeJob(@Param('id', ParseIntPipe) id: number, @Body('operatorNote') operatorNote?: string) {
        return this.productionService.completeJob(id, operatorNote);
    }

    @Post('jobs/:id/start-assembly')
    startAssembly(@Param('id', ParseIntPipe) id: number, @Body('assemblyNote') assemblyNote?: string) {
        return this.productionService.startAssembly(id, assemblyNote);
    }

    @Post('jobs/:id/complete-assembly')
    completeAssembly(@Param('id', ParseIntPipe) id: number, @Body('assemblyNote') assemblyNote?: string) {
        return this.productionService.completeAssembly(id, assemblyNote);
    }

    @Post('jobs/:id/pickup')
    pickupJob(@Param('id', ParseIntPipe) id: number) {
        return this.productionService.pickupJob(id);
    }

    @Post('jobs/bulk-pickup')
    bulkPickup(@Body() body: { ids: number[]; branchId?: number | null }) {
        return this.productionService.bulkPickup(body?.ids ?? [], body?.branchId);
    }

    @Post('batches')
    createBatch(
        @Body() data: { jobIds: number[]; rollVariantId?: number; usedWaste: boolean; totalAreaM2?: number },
    ) {
        return this.productionService.createBatch(data);
    }

    @Post('batches/:id/complete')
    completeBatch(@Param('id', ParseIntPipe) id: number) {
        return this.productionService.completeBatch(id);
    }

    // ─── Meter Reading (Rekonsiliasi Operator) ───────────────────────────────
    // Public endpoint untuk operator di /cetak — tidak butuh JWT, gated by PIN
    // di sisi client. Reuse ClickCountingService dengan fake BranchContext.

    /** Upload foto counter mesin — operator tidak perlu login */
    @Post('meter/upload-photo')
    @UseInterceptors(FileInterceptor('image', {
        storage: diskStorage({
            destination: METER_DIR,
            filename: (_req, file, cb) => cb(null, `meter_${randomHex()}${extname(file.originalname || '.jpg')}`),
        }),
        fileFilter: (_req, file, cb) => {
            if (!file.mimetype || !file.mimetype.startsWith('image/')) {
                return cb(new BadRequestException('Hanya file gambar yang diperbolehkan'), false);
            }
            cb(null, true);
        },
        limits: { fileSize: 10 * 1024 * 1024 },
    }))
    async uploadMeterPhoto(@UploadedFile() file: Express.Multer.File) {
        if (!file) throw new BadRequestException('File foto wajib diisi');
        await compressImage(file.path);
        return { url: `/uploads/${file.filename}` };
    }

    /** Upsert pembacaan counter harian — terima branchId di body karena public */
    @Post('meter/reading')
    async upsertMeterReading(
        @Body() body: {
            branchId: number;
            readingDate: string;
            totalCount: number;
            fullColorCount: number;
            blackCount: number;
            singleColorCount?: number;
            photoUrl?: string;
            notes?: string;
        },
    ) {
        if (!body?.branchId) throw new BadRequestException('branchId wajib diisi');
        const ctx = fakeOperatorCtx(Number(body.branchId));
        const { branchId: _, ...payload } = body;
        return this.clickCounting.upsertMeterReading(payload, ctx);
    }

    /** List pembacaan counter (history) untuk operator review */
    @Get('meter/readings')
    async getMeterReadings(
        @Query('branchId') branchIdParam: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        const branchId = Number(branchIdParam);
        if (!branchId || Number.isNaN(branchId)) {
            throw new BadRequestException('branchId wajib diisi');
        }
        const ctx = fakeOperatorCtx(branchId);
        return this.clickCounting.getMeterReadings(ctx, startDate, endDate);
    }

    /** Catat reject mesin dari operator (public, gated by PIN di client) */
    @Post('meter/reject')
    async createReject(
        @Body() body: {
            branchId: number;
            rejectType: string;
            cause?: string;
            counterType?: string;
            quantity: number;
            pricePerClick?: number;
            notes?: string;
            photoUrl?: string;
            date?: string;
        },
    ) {
        if (!body?.branchId) throw new BadRequestException('branchId wajib diisi');
        const ctx = fakeOperatorCtx(Number(body.branchId));
        const { branchId: _, ...payload } = body;
        return this.clickCounting.createReject(payload, ctx);
    }

    /** List reject mesin bulan tertentu untuk operator review */
    @Get('meter/rejects')
    async getRejects(
        @Query('branchId') branchIdParam: string,
        @Query('month') month?: string,
        @Query('year') year?: string,
    ) {
        const branchId = Number(branchIdParam);
        if (!branchId || Number.isNaN(branchId)) {
            throw new BadRequestException('branchId wajib diisi');
        }
        const ctx = fakeOperatorCtx(branchId);
        return this.clickCounting.getRejects(ctx, month ? +month : undefined, year ? +year : undefined);
    }
}
