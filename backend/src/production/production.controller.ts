import { Controller, Delete, Get, Post, Body, Param, ParseIntPipe, Patch, Query, Req, UseGuards, UseInterceptors, UploadedFile, BadRequestException, ForbiddenException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtService } from '@nestjs/jwt';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';
import { BoardOrUserGuard, boardSessionOf, hidePhonesForBoard, signBoardToken } from '../auth/board-auth';
import { ManagerGuard, roleCanOpenMenu } from '../auth/role-groups';
import { PinThrottleInterceptor } from '../auth/pin-throttle.interceptor';
import { assertRealImage, discardUpload, safeImageExt, safeImageFilter } from '../common/utils/safe-image-upload.util';
import { ProductionService } from './production.service';
import { ClickCountingService } from '../click-counting/click-counting.service';
import { compressImage } from '../common/utils/compress-image.util';
import type { BranchContext } from '../common/branch-context.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentBranch, isOwnerRole } from '../common/branch-context.decorator';
import { assertBranchAccess } from '../common/branch-where.helper';

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

/**
 * Cabang untuk MENULIS meter/reject mesin — jangan percaya branchId kiriman body.
 * - Papan kerja: cabang dari token PIN (req.board).
 * - Akun login: wajib menu Klik Mesin Cetak (sama dgn /click-counting); staf dikunci ke
 *   cabangnya (seperti @CurrentBranch), owner pakai cabang aktif (header) atau isian body.
 * (@CurrentBranch tak bisa dipakai di sini: melempar galat untuk request papan kerja.)
 */
function meterWriteCtx(req: any, bodyBranchId?: number | string | null): BranchContext {
    const board = boardSessionOf(req);
    if (board) {
        if (board.branchId == null) throw new BadRequestException('Sesi papan kerja tanpa cabang. Masukkan PIN cabang lagi.');
        return fakeOperatorCtx(board.branchId);
    }
    const user = req?.user ?? {};
    if (!roleCanOpenMenu(user.roleName, user.menuAccess, '/click-counting')) {
        throw new ForbiddenException('Akses ditolak: peran Anda tidak diberi menu ini. Minta owner mengaturnya di Akses Menu Role.');
    }
    const userBranchId: number | null = typeof user.branchId === 'number' ? user.branchId : null;
    if (!isOwnerRole(user.roleName)) {
        if (userBranchId == null) throw new ForbiddenException('User staff belum ter-assign ke cabang manapun. Hubungi admin.');
        return { branchId: userBranchId, isOwner: false, userBranchId, roleName: user.roleName ?? null };
    }
    const bid = Number(req?.headers?.['x-branch-id'] ?? bodyBranchId);
    if (!Number.isInteger(bid) || bid <= 0) {
        throw new BadRequestException('Aksi ini butuh cabang spesifik. Pilih cabang di topbar terlebih dahulu (bukan "Semua Cabang").');
    }
    return { branchId: bid, isOwner: true, userBranchId, roleName: user.roleName ?? null };
}

// Papan kerja /produksi dipakai tanpa akun login. Endpoint papan kerja dijaga
// BoardOrUserGuard: wajib token papan kerja (didapat setelah PIN benar di server)
// ATAU token login akun. Dulu PIN hanya dicek di peramban, sehingga siapa pun di
// internet bisa membaca data pelanggan & mengubah status job (T-17).
@Controller('production')
export class ProductionController {
    constructor(
        private readonly productionService: ProductionService,
        private readonly clickCounting: ClickCountingService,
        private readonly jwt: JwtService,
    ) {}

    @Get('jobs')
    @UseGuards(BoardOrUserGuard)
    async getJobs(
        @Req() req: any,
        @Query('status') status?: string,
        @Query('priority') priority?: string,
        @Query('branchId') branchId?: string,
    ) {
        return hidePhonesForBoard(req, await this.productionService.getJobs(status, priority, branchId ? parseInt(branchId) : undefined));
    }

    @Get('rolls')
    @UseGuards(BoardOrUserGuard)
    getRolls(@Query('branchId') branchId?: string) {
        return this.productionService.getRolls(branchId ? parseInt(branchId) : undefined);
    }

    @Get('stats')
    @UseGuards(BoardOrUserGuard)
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
    async updatePipelineStage(
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
        @CurrentBranch() ctx: BranchContext,
    ) {
        assertBranchAccess(ctx, (await this.productionService.getJobMeta(id)).branchId);
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

    /** Hapus production job (beserta proofs — cascade). Setingkat manajer, cabangnya sendiri. */
    @UseGuards(JwtAuthGuard, ManagerGuard)
    @Delete('pipeline/jobs/:id')
    async deleteJob(@Param('id', ParseIntPipe) id: number, @CurrentBranch() ctx: BranchContext) {
        assertBranchAccess(ctx, (await this.productionService.getJobMeta(id)).branchId);
        return this.productionService.deleteJob(id);
    }

    /** Tandai job batal / klien tidak jadi order (atau batalkan status batal). Setingkat manajer. */
    @UseGuards(JwtAuthGuard, ManagerGuard)
    @Patch('pipeline/jobs/:id/cancel')
    async cancelJob(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: { cancel?: boolean; reason?: string },
        @Req() req: any,
        @CurrentBranch() ctx: BranchContext,
    ) {
        assertBranchAccess(ctx, (await this.productionService.getJobMeta(id)).branchId);
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
    @UseInterceptors(PinThrottleInterceptor)
    async getPublicPipelineJobs(
        @Query('pin') pin: string,
        @Query('branchId') branchId?: string,
    ) {
        const bid = branchId ? parseInt(branchId) : undefined;
        await this.productionService.verifyOperatorPinPublic(pin, bid);
        return this.productionService.getPipelineJobs(bid);
    }

    @Patch('pipeline/public/jobs/:id')
    @UseInterceptors(PinThrottleInterceptor)
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
            coOperatorNames?: string[];
        },
    ) {
        await this.productionService.verifyOperatorPinPublic(body.pin, body.branchId);
        if (!body.operatorName?.trim()) {
            throw new BadRequestException('Nama operator wajib diisi');
        }
        // PIN cabang A tidak boleh memindah job cabang B (id job berurutan).
        const pinBranchId = Number(body.branchId);
        if (!Number.isInteger(pinBranchId) || pinBranchId <= 0) throw new BadRequestException('branchId wajib diisi');
        const job = await this.productionService.getJobMeta(id);
        if (job.branchId !== pinBranchId) throw new ForbiddenException('Job ini milik cabang lain');
        const { pin: _p, branchId, operatorName, ...data } = body;
        // branchId = cabang PIN operator → dipakai atribusi leaderboard (bukan dibuang).
        return this.productionService.updatePipelineStage(id, data, { name: operatorName.trim(), role: 'OPERATOR', branchId: branchId ?? null });
    }

    @Post('pipeline/public/jobs/:id/proof-image')
    @UseInterceptors(PinThrottleInterceptor, FileInterceptor('image', {
        storage: diskStorage({
            destination: METER_DIR,
            filename: (_req, file, cb) => cb(null, `proof_${randomHex()}${safeImageExt(file.mimetype) ?? '.jpg'}`),
        }),
        fileFilter: safeImageFilter,
        limits: { fileSize: 10 * 1024 * 1024 },
    }))
    async uploadPublicProofImage(
        @Param('id', ParseIntPipe) id: number,
        @UploadedFile() file: Express.Multer.File,
        @Body() body: { pin: string; branchId?: string; operatorName: string; designerName?: string },
    ) {
        if (!file) throw new BadRequestException('File foto wajib diisi');
        const bid = body.branchId ? parseInt(body.branchId) : undefined;
        try {
            await this.productionService.verifyOperatorPinPublic(body.pin, bid);
            if (!body.operatorName?.trim()) {
                throw new BadRequestException('Nama operator wajib diisi');
            }
            // Sama dgn ubah tahap: hanya job cabang PIN ini.
            if (!bid) throw new BadRequestException('branchId wajib diisi');
            if ((await this.productionService.getJobMeta(id)).branchId !== bid) throw new ForbiddenException('Job ini milik cabang lain');
        } catch (e) {
            discardUpload(file); // multer sudah menyimpan berkas sebelum PIN dicek
            throw e;
        }
        await assertRealImage(file.path);
        await compressImage(file.path);
        const url = `/uploads/${file.filename}`;
        const proof = await this.productionService.addProof(id, url, { name: body.operatorName.trim(), role: 'OPERATOR' }, body.designerName);
        await this.productionService.updatePipelineStage(id, { proofImageUrl: url });
        return { url, proofId: proof.id };
    }

    @Patch('pipeline/public/proofs/:proofId/delete')
    @UseInterceptors(PinThrottleInterceptor)
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

    /** PIN cabang benar → ikut dapat token papan kerja untuk endpoint di bawah. */
    @Post('pin/verify')
    @UseInterceptors(PinThrottleInterceptor)
    async verifyPin(@Body('pin') pin: string, @Body('branchId') branchId?: number) {
        const r = await this.productionService.verifyPin(pin, branchId);
        if (!r.valid) return r;
        return { ...r, boardToken: signBoardToken(this.jwt, { branchId: branchId ?? null }) };
    }

    @Post('jobs/:id/start')
    @UseGuards(BoardOrUserGuard)
    startJob(
        @Param('id', ParseIntPipe) id: number,
        @Body() data: { rollVariantId?: number; usedWaste: boolean; rollAreaM2?: number; operatorNote?: string },
    ) {
        return this.productionService.startJob(id, data);
    }

    @Post('jobs/:id/complete')
    @UseGuards(BoardOrUserGuard)
    completeJob(@Param('id', ParseIntPipe) id: number, @Body() body: { operatorNote?: string; operatorName?: string; coOperatorNames?: string[]; branchId?: number }) {
        return this.productionService.completeJob(id, body?.operatorNote, body?.operatorName, body?.coOperatorNames, body?.branchId ?? null);
    }

    @Post('jobs/:id/start-assembly')
    @UseGuards(BoardOrUserGuard)
    startAssembly(@Param('id', ParseIntPipe) id: number, @Body('assemblyNote') assemblyNote?: string) {
        return this.productionService.startAssembly(id, assemblyNote);
    }

    @Post('jobs/:id/complete-assembly')
    @UseGuards(BoardOrUserGuard)
    completeAssembly(@Param('id', ParseIntPipe) id: number, @Body() body: { assemblyNote?: string; operatorName?: string; coOperatorNames?: string[]; branchId?: number }) {
        return this.productionService.completeAssembly(id, body?.assemblyNote, body?.operatorName, body?.coOperatorNames, body?.branchId ?? null);
    }

    @Post('jobs/:id/pickup')
    @UseGuards(BoardOrUserGuard)
    pickupJob(@Param('id', ParseIntPipe) id: number) {
        return this.productionService.pickupJob(id);
    }

    @Post('jobs/bulk-pickup')
    @UseGuards(BoardOrUserGuard)
    bulkPickup(@Body() body: { ids: number[]; branchId?: number | null }) {
        return this.productionService.bulkPickup(body?.ids ?? [], body?.branchId);
    }

    @Post('batches')
    @UseGuards(BoardOrUserGuard)
    createBatch(
        @Body() data: { jobIds: number[]; rollVariantId?: number; usedWaste: boolean; totalAreaM2?: number },
    ) {
        return this.productionService.createBatch(data);
    }

    @Post('batches/:id/complete')
    @UseGuards(BoardOrUserGuard)
    completeBatch(@Param('id', ParseIntPipe) id: number, @Body() body: { operatorName?: string; coOperatorNames?: string[]; branchId?: number }) {
        return this.productionService.completeBatch(id, body?.operatorName, body?.coOperatorNames, body?.branchId ?? null);
    }

    // ─── Meter Reading (Rekonsiliasi Operator) ───────────────────────────────
    // Endpoint untuk operator di /cetak (tanpa akun login) — dijaga token papan
    // kerja. Reuse ClickCountingService dengan fake BranchContext.

    /** Upload foto counter mesin — ekstensi ditentukan server dari tipe gambar (T-18). */
    @Post('meter/upload-photo')
    @UseGuards(BoardOrUserGuard)
    @UseInterceptors(FileInterceptor('image', {
        storage: diskStorage({
            destination: METER_DIR,
            filename: (_req, file, cb) => cb(null, `meter_${randomHex()}${safeImageExt(file.mimetype) ?? '.jpg'}`),
        }),
        fileFilter: safeImageFilter,
        limits: { fileSize: 10 * 1024 * 1024 },
    }))
    async uploadMeterPhoto(@UploadedFile() file: Express.Multer.File) {
        if (!file) throw new BadRequestException('File foto wajib diisi');
        await assertRealImage(file.path);
        await compressImage(file.path);
        return { url: `/uploads/${file.filename}` };
    }

    /** Upsert pembacaan counter harian — terima branchId di body karena public */
    @Post('meter/reading')
    @UseGuards(BoardOrUserGuard)
    async upsertMeterReading(
        @Req() req: any,
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
        const ctx = meterWriteCtx(req, body?.branchId);
        const { branchId: _, ...payload } = body;
        return this.clickCounting.upsertMeterReading(payload, ctx);
    }

    /** List pembacaan counter (history) untuk operator review */
    @Get('meter/readings')
    @UseGuards(BoardOrUserGuard)
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
    @UseGuards(BoardOrUserGuard)
    async createReject(
        @Req() req: any,
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
        const ctx = meterWriteCtx(req, body?.branchId);
        const { branchId: _, ...payload } = body;
        return this.clickCounting.createReject(payload, ctx);
    }

    /** List reject mesin bulan tertentu untuk operator review */
    @Get('meter/rejects')
    @UseGuards(BoardOrUserGuard)
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
