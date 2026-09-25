import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Req, UseGuards, UseInterceptors, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrintQueueService } from './print-queue.service';
import type { PrintJobStatus } from './print-queue.service';
import { BoardOrUserGuard, boardSessionOf, hidePhonesForBoard, signBoardToken } from '../auth/board-auth';
import { isOwnerRole } from '../common/branch-context.decorator';
import { ButuhFitur } from '../lisensi/butuh-fitur.decorator';

/** Cabang yang boleh dilihat/digerakkan: papan → cabang PIN; staf → cabangnya; owner → bebas (null). */
function cabangPapan(req: any): number | null {
    const board = boardSessionOf(req);
    if (board) return board.branchId ?? null;
    const user = req?.user ?? {};
    if (isOwnerRole(user.roleName)) return null;
    return typeof user.branchId === 'number' ? user.branchId : null;
}
import { PinThrottleInterceptor } from '../auth/pin-throttle.interceptor';

// Papan /cetak dipakai tanpa akun login: semua endpoint (kecuali verifikasi PIN)
// wajib token papan kerja ATAU token login akun — sama dengan /production (T-17).
//
// Antrian cetak = kode fitur lisensi `print.queue` (paket Produksi & Bisnis). Seluruh
// controller dijaga karena modulnya memang satu fitur utuh — termasuk verifikasi PIN,
// sebab papan cetak tanpa antrian tidak ada isinya. Tanpa kunci lisensi: tidak berpengaruh.
@ButuhFitur('print.queue')
@Controller('print-queue')
export class PrintQueueController {
    constructor(
        private readonly svc: PrintQueueService,
        private readonly jwt: JwtService,
    ) {}

    @Get('jobs')
    @UseGuards(BoardOrUserGuard)
    async list(
        @Req() req: any,
        @Query('status') status?: PrintJobStatus,
        @Query('search') search?: string,
        @Query('branchId') branchId?: string,
        @Query('page') page?: string,
        @Query('pageSize') pageSize?: string,
    ) {
        return hidePhonesForBoard(req, await this.svc.listJobs(
            status,
            search,
            cabangPapan(req) ?? (branchId ? parseInt(branchId) : undefined), // papan/staf: cabangnya sendiri
            page ? parseInt(page) : 1,
            pageSize ? parseInt(pageSize) : 20,
        ));
    }

    @Get('stats')
    @UseGuards(BoardOrUserGuard)
    stats(@Req() req: any, @Query('branchId') branchId?: string) {
        return this.svc.stats(cabangPapan(req) ?? (branchId ? parseInt(branchId) : undefined));
    }

    /** Satu-satunya pintu tanpa token: PIN benar → dapat token papan kerja. */
    @Post('pin/verify')
    @UseInterceptors(PinThrottleInterceptor)
    async verifyPin(@Body('pin') pin: string, @Body('branchId') branchId?: number) {
        // Papan kerja SELALU satu cabang. Tanpa cabang (mis. daftar cabang gagal dimuat) dulu terbit
        // token "semua cabang" → operator melihat & memindah job cabang lain (stok cabang lain terpotong).
        const bid = Number(branchId);
        if (!Number.isInteger(bid) || bid <= 0) throw new BadRequestException('Pilih cabang dulu, lalu masukkan PIN.');
        const r = await this.svc.verifyPin(pin, bid);
        if (!r.valid) return r;
        return { ...r, boardToken: signBoardToken(this.jwt, { branchId: bid }, pin) };
    }

    @Post('jobs/:id/start')
    @UseGuards(BoardOrUserGuard)
    async start(@Param('id', ParseIntPipe) id: number, @Body('operatorName') operatorName: string | undefined, @Req() req: any) {
        await this.svc.assertJobsInBranch([id], cabangPapan(req));
        return this.svc.startJob(id, boardSessionOf(req)?.name || operatorName); // nama dari PIN pribadi bila ada
    }

    @Post('jobs/:id/finish')
    @UseGuards(BoardOrUserGuard)
    async finish(@Param('id', ParseIntPipe) id: number, @Body() body: { operatorName?: string; coOperatorNames?: string[]; branchId?: number }, @Req() req: any) {
        await this.svc.assertJobsInBranch([id], cabangPapan(req));
        return this.svc.finishJob(id, boardSessionOf(req)?.name || body?.operatorName, body?.coOperatorNames, body?.branchId ?? null);
    }

    @Post('jobs/:id/pickup')
    @UseGuards(BoardOrUserGuard)
    async pickup(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
        await this.svc.assertJobsInBranch([id], cabangPapan(req));
        return this.svc.pickupJob(id);
    }

    @Post('jobs/bulk-pickup')
    @UseGuards(BoardOrUserGuard)
    async bulkPickup(@Body() body: { ids: number[]; branchId?: number | null }, @Req() req: any) {
        await this.svc.assertJobsInBranch(body?.ids ?? [], cabangPapan(req));
        return this.svc.bulkPickup(body?.ids ?? [], body?.branchId);
    }

    @Post('jobs/:id/notes')
    @UseGuards(BoardOrUserGuard)
    async notes(@Param('id', ParseIntPipe) id: number, @Body('notes') notes: string, @Req() req: any) {
        await this.svc.assertJobsInBranch([id], cabangPapan(req));
        return this.svc.updateNotes(id, notes);
    }
}
