import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    Get,
    Headers,
    Param,
    ParseIntPipe,
    Patch,
    Post,
    Query,
    UnauthorizedException,
    UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentBranch } from '../common/branch-context.decorator';
import type { BranchContext } from '../common/branch-context.decorator';
import { assertBranchAccess } from '../common/branch-where.helper';
import { PrinterRelayRegistry } from './printer-relay.registry';
import {
    PrinterRelayService,
    type CreateDevicePayload,
    type UpdateDevicePayload,
} from './printer-relay.service';

// Lama backend menahan request long-poll agen (di bawah timeout HTTP umum).
const POLL_HOLD_MS = 25_000;

@Controller('printer-relay')
export class PrinterRelayController {
    constructor(
        private readonly service: PrinterRelayService,
        private readonly registry: PrinterRelayRegistry,
    ) { }

    // ── Endpoint AGEN (auth: header x-printer-token, bukan JWT) ─────────────

    /** Long-poll: agen menanyakan job. Ditahan sampai ada job atau ~25s. */
    @Get('poll')
    async poll(@Headers('x-printer-token') token?: string) {
        const dev = await this.service.deviceByToken(token);
        if (!dev) throw new UnauthorizedException('Token printer tidak valid.');
        this.registry.markSeen(dev.branchId);
        await this.service.touchLastSeen(dev.id);
        const job = await this.registry.waitForJob(dev.branchId, POLL_HOLD_MS);
        return { job }; // { job: null } bila timeout — agen poll lagi
    }

    /** Agen mengonfirmasi hasil cetak sebuah job. */
    @Post('ack')
    async ack(
        @Headers('x-printer-token') token: string | undefined,
        @Body() body: { jobId?: string; ok?: boolean; error?: string; target?: string },
    ) {
        const dev = await this.service.deviceByToken(token);
        if (!dev) throw new UnauthorizedException('Token printer tidak valid.');
        if (!body?.jobId) throw new BadRequestException('jobId wajib.');
        this.registry.resolveAck(body.jobId, {
            ok: !!body.ok,
            error: body.error,
            target: body.target,
        });
        return { ok: true };
    }

    // ── Endpoint KASIR (JWT) ────────────────────────────────────────────────

    /** Kirim struk ESC/POS (base64) → diteruskan ke agen cabang → tunggu ack. */
    @UseGuards(JwtAuthGuard)
    @Post('jobs')
    async submit(
        @Body() body: { branchId?: number; dataBase64?: string },
        @CurrentBranch() ctx: BranchContext,
    ) {
        const branchId = ctx.isOwner ? (body.branchId ?? ctx.branchId) : ctx.userBranchId;
        if (branchId == null) {
            throw new BadRequestException('Cabang tak ditentukan. Pilih cabang dulu.');
        }
        assertBranchAccess(ctx, branchId);
        const ack = await this.service.submitAndWait(branchId, body.dataBase64 ?? '');
        return { ok: true, target: ack.target ?? null };
    }

    /** Status printer server cabang (online/offline) untuk UI cetak. */
    @UseGuards(JwtAuthGuard)
    @Get('status')
    status(@CurrentBranch() ctx: BranchContext) {
        const branchId = ctx.branchId ?? ctx.userBranchId;
        if (branchId == null) return { branchId: null, online: false, lastSeenAt: null };
        return this.service.statusFor(branchId);
    }

    // ── Manajemen perangkat (Owner) ─────────────────────────────────────────

    @UseGuards(JwtAuthGuard)
    @Get('devices')
    list(@Query('branchId') branchId: string | undefined, @CurrentBranch() ctx: BranchContext) {
        return this.service.list(ctx, branchId ? Number(branchId) : undefined);
    }

    @UseGuards(JwtAuthGuard)
    @Post('devices')
    create(@Body() body: CreateDevicePayload, @CurrentBranch() ctx: BranchContext) {
        return this.service.create(ctx, body);
    }

    @UseGuards(JwtAuthGuard)
    @Patch('devices/:id')
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: UpdateDevicePayload,
        @CurrentBranch() ctx: BranchContext,
    ) {
        return this.service.update(ctx, id, body);
    }

    @UseGuards(JwtAuthGuard)
    @Post('devices/:id/rotate-token')
    rotate(@Param('id', ParseIntPipe) id: number, @CurrentBranch() ctx: BranchContext) {
        return this.service.rotateToken(ctx, id);
    }

    @UseGuards(JwtAuthGuard)
    @Delete('devices/:id')
    remove(@Param('id', ParseIntPipe) id: number, @CurrentBranch() ctx: BranchContext) {
        return this.service.remove(ctx, id);
    }
}
