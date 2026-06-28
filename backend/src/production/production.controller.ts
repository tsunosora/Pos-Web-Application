import { Controller, Delete, Get, Post, Body, Param, ParseIntPipe, Patch, Query, Req, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';
import { ProductionService } from './production.service';
import { ClickCountingService } from '../click-counting/click-counting.service';
import { compressImage } from '../common/utils/compress-image.util';
import type { BranchContext } from '../common/branch-context.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentBranch } from '../common/branch-context.decorator';

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

    // ─── Pipeline Kanban (admin view, JWT) ─────────────────────────────────────
    @UseGuards(JwtAuthGuard)
    @Get('pipeline/jobs')
    getPipelineJobs(@CurrentBranch() ctx: BranchContext) {
        return this.productionService.getPipelineJobs(ctx.branchId ?? undefined);
    }

    @UseGuards(JwtAuthGuard)
    @Patch('pipeline/jobs/:id')
    updatePipelineStage(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: {
            pipelineStage?: string;
            penjahitName?: string;
            jahitInDate?: string;
            jahitEstimate?: string;
            qcNote?: string;
            returnReason?: string;
            proofImageUrl?: string | null;
        },
        @Req() req: any,
    ) {
        const actorName = req?.user?.name || req?.user?.email || 'Admin';
        return this.productionService.updatePipelineStage(id, body, { name: actorName, role: 'ADMIN' });
    }

    /** Upload proof image (multi-image, append). Return URL relatif `/uploads/...`. */
    @UseGuards(JwtAuthGuard)
    @Post('pipeline/jobs/:id/proof-image')
    @UseInterceptors(FileInterceptor('image', {
        storage: diskStorage({
            destination: METER_DIR,
            filename: (_req, file, cb) => cb(null, `proof_${randomHex()}${extname(file.originalname || '.jpg')}`),
        }),
        fileFilter: (_req, file, cb) => {
            if (!file.mimetype || !file.mimetype.startsWith('image/')) {
                return cb(new BadRequestException('Hanya file gambar yang diperbolehkan'), false);
            }
            cb(null, true);
        },
        limits: { fileSize: 10 * 1024 * 1024 },
    }))
    async uploadProofImage(
        @Param('id', ParseIntPipe) id: number,
        @UploadedFile() file: Express.Multer.File,
        @Req() req: any,
        @Body('designerName') designerName?: string,
    ) {
        if (!file) throw new BadRequestException('File foto wajib diisi');
        await compressImage(file.path);
        const url = `/uploads/${file.filename}`;
        const actorName = req?.user?.name || req?.user?.email || 'Admin';
        const proof = await this.productionService.addProof(id, url, { name: actorName, role: 'ADMIN' }, designerName);
        await this.productionService.updatePipelineStage(id, { proofImageUrl: url });
        return { url, proofId: proof.id };
    }

    /** Hapus production job (beserta proofs — cascade). */
    @UseGuards(JwtAuthGuard)
    @Delete('pipeline/jobs/:id')
    async deleteJob(@Param('id', ParseIntPipe) id: number) {
        return this.productionService.deleteJob(id);
    }

    /** Tandai job batal / klien tidak jadi order (atau batalkan status batal). */
    @UseGuards(JwtAuthGuard)
    @Patch('pipeline/jobs/:id/cancel')
    async cancelJob(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: { cancel?: boolean; reason?: string },
        @Req() req: any,
    ) {
        const actorName = req?.user?.name || req?.user?.email || 'Admin';
        return this.productionService.setJobCancelled(id, body.cancel !== false, body.reason, { name: actorName });
    }

    /** Hapus satu proof image dari job. */
    @UseGuards(JwtAuthGuard)
    @Patch('pipeline/proofs/:proofId/delete')
    async deleteProofImage(@Param('proofId', ParseIntPipe) proofId: number, @Req() req: any) {
        const actorName = req?.user?.name || req?.user?.email || 'Admin';
        return this.productionService.deleteProof(proofId, { name: actorName, role: 'ADMIN' });
    }

    // ─── Public Pipeline (OPERATOR — PIN-protected) ────────────────────────────
    // Operator/desainer akses via /produksi/board (tanpa JWT). Tiap request kirim
    // PIN + branchId + operatorName. PIN di-verify di backend, operatorName masuk
    // audit log + lastUpdatedBy.

    @Get('pipeline/public/jobs')
    async getPublicPipelineJobs(
        @Query('pin') pin: string,
        @Query('branchId') branchId?: string,
    ) {
        const bid = branchId ? parseInt(branchId) : undefined;
        await this.productionService.verifyOperatorPinPublic(pin, bid);
        return this.productionService.getPipelineJobs(bid);
    }

    @Patch('pipeline/public/jobs/:id')
    async updatePublicPipelineStage(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: {
            pin: string;
            branchId?: number;
            operatorName: string;
            pipelineStage?: string;
            penjahitName?: string;
            jahitInDate?: string;
            jahitEstimate?: string;
            qcNote?: string;
            returnReason?: string;
        },
    ) {
        await this.productionService.verifyOperatorPinPublic(body.pin, body.branchId);
        if (!body.operatorName?.trim()) {
            throw new BadRequestException('Nama operator wajib diisi');
        }
        const { pin: _p, branchId: _b, operatorName, ...data } = body;
        return this.productionService.updatePipelineStage(id, data, { name: operatorName.trim(), role: 'OPERATOR' });
    }

    @Post('pipeline/public/jobs/:id/proof-image')
    @UseInterceptors(FileInterceptor('image', {
        storage: diskStorage({
            destination: METER_DIR,
            filename: (_req, file, cb) => cb(null, `proof_${randomHex()}${extname(file.originalname || '.jpg')}`),
        }),
        fileFilter: (_req, file, cb) => {
            if (!file.mimetype || !file.mimetype.startsWith('image/')) {
                return cb(new BadRequestException('Hanya file gambar yang diperbolehkan'), false);
            }
            cb(null, true);
        },
        limits: { fileSize: 10 * 1024 * 1024 },
    }))
    async uploadPublicProofImage(
        @Param('id', ParseIntPipe) id: number,
        @UploadedFile() file: Express.Multer.File,
        @Body() body: { pin: string; branchId?: string; operatorName: string; designerName?: string },
    ) {
        if (!file) throw new BadRequestException('File foto wajib diisi');
        const bid = body.branchId ? parseInt(body.branchId) : undefined;
        await this.productionService.verifyOperatorPinPublic(body.pin, bid);
        if (!body.operatorName?.trim()) {
            throw new BadRequestException('Nama operator wajib diisi');
        }
        await compressImage(file.path);
        const url = `/uploads/${file.filename}`;
        const proof = await this.productionService.addProof(id, url, { name: body.operatorName.trim(), role: 'OPERATOR' }, body.designerName);
        await this.productionService.updatePipelineStage(id, { proofImageUrl: url });
        return { url, proofId: proof.id };
    }

    @Patch('pipeline/public/proofs/:proofId/delete')
    async deletePublicProofImage(
        @Param('proofId', ParseIntPipe) proofId: number,
        @Body() body: { pin: string; branchId?: number; operatorName: string },
    ) {
        await this.productionService.verifyOperatorPinPublic(body.pin, body.branchId);
        if (!body.operatorName?.trim()) {
            throw new BadRequestException('Nama operator wajib diisi');
        }
        return this.productionService.deleteProof(proofId, { name: body.operatorName.trim(), role: 'OPERATOR' });
    }

    @Get('pipeline/jobs/:id/activities')
    @UseGuards(JwtAuthGuard)
    async getJobActivities(@Param('id', ParseIntPipe) id: number) {
        return this.productionService.getJobActivities(id);
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
    completeJob(@Param('id', ParseIntPipe) id: number, @Body() body: { operatorNote?: string; operatorName?: string }) {
        return this.productionService.completeJob(id, body?.operatorNote, body?.operatorName);
    }

    @Post('jobs/:id/start-assembly')
    startAssembly(@Param('id', ParseIntPipe) id: number, @Body('assemblyNote') assemblyNote?: string) {
        return this.productionService.startAssembly(id, assemblyNote);
    }

    @Post('jobs/:id/complete-assembly')
    completeAssembly(@Param('id', ParseIntPipe) id: number, @Body() body: { assemblyNote?: string; operatorName?: string }) {
        return this.productionService.completeAssembly(id, body?.assemblyNote, body?.operatorName);
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
    completeBatch(@Param('id', ParseIntPipe) id: number, @Body('operatorName') operatorName?: string) {
        return this.productionService.completeBatch(id, operatorName);
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
