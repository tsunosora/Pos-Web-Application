import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrintQueueService } from './print-queue.service';
import type { PrintJobStatus } from './print-queue.service';
import { BoardOrUserGuard, hidePhonesForBoard, signBoardToken } from '../auth/board-auth';
import { PinThrottleInterceptor } from '../auth/pin-throttle.interceptor';

// Papan /cetak dipakai tanpa akun login: semua endpoint (kecuali verifikasi PIN)
// wajib token papan kerja ATAU token login akun — sama dengan /production (T-17).
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
            branchId ? parseInt(branchId) : undefined,
            page ? parseInt(page) : 1,
            pageSize ? parseInt(pageSize) : 20,
        ));
    }

    @Get('stats')
    @UseGuards(BoardOrUserGuard)
    stats(@Query('branchId') branchId?: string) {
        return this.svc.stats(branchId ? parseInt(branchId) : undefined);
    }

    /** Satu-satunya pintu tanpa token: PIN benar → dapat token papan kerja. */
    @Post('pin/verify')
    @UseInterceptors(PinThrottleInterceptor)
    async verifyPin(@Body('pin') pin: string, @Body('branchId') branchId?: number) {
        const r = await this.svc.verifyPin(pin, branchId);
        if (!r.valid) return r;
        return { ...r, boardToken: signBoardToken(this.jwt, { branchId: branchId ?? null }) };
    }

    @Post('jobs/:id/start')
    @UseGuards(BoardOrUserGuard)
    start(@Param('id', ParseIntPipe) id: number, @Body('operatorName') operatorName?: string) {
        return this.svc.startJob(id, operatorName);
    }

    @Post('jobs/:id/finish')
    @UseGuards(BoardOrUserGuard)
    finish(@Param('id', ParseIntPipe) id: number, @Body() body: { operatorName?: string; coOperatorNames?: string[]; branchId?: number }) {
        return this.svc.finishJob(id, body?.operatorName, body?.coOperatorNames, body?.branchId ?? null);
    }

    @Post('jobs/:id/pickup')
    @UseGuards(BoardOrUserGuard)
    pickup(@Param('id', ParseIntPipe) id: number) {
        return this.svc.pickupJob(id);
    }

    @Post('jobs/bulk-pickup')
    @UseGuards(BoardOrUserGuard)
    bulkPickup(@Body() body: { ids: number[]; branchId?: number | null }) {
        return this.svc.bulkPickup(body?.ids ?? [], body?.branchId);
    }

    @Post('jobs/:id/notes')
    @UseGuards(BoardOrUserGuard)
    notes(@Param('id', ParseIntPipe) id: number, @Body('notes') notes: string) {
        return this.svc.updateNotes(id, notes);
    }
}
