import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { PrintQueueService } from './print-queue.service';
import type { PrintJobStatus } from './print-queue.service';

// All endpoints public (PIN-gated on client) — consistent with /production
@Controller('print-queue')
export class PrintQueueController {
    constructor(private readonly svc: PrintQueueService) {}

    @Get('jobs')
    list(
        @Query('status') status?: PrintJobStatus,
        @Query('search') search?: string,
        @Query('branchId') branchId?: string,
    ) {
        return this.svc.listJobs(status, search, branchId ? parseInt(branchId) : undefined);
    }

    @Get('stats')
    stats(@Query('branchId') branchId?: string) {
        return this.svc.stats(branchId ? parseInt(branchId) : undefined);
    }

    @Post('pin/verify')
    verifyPin(@Body('pin') pin: string, @Body('branchId') branchId?: number) {
        return this.svc.verifyPin(pin, branchId);
    }

    @Post('jobs/:id/start')
    start(@Param('id', ParseIntPipe) id: number, @Body('operatorName') operatorName?: string) {
        return this.svc.startJob(id, operatorName);
    }

    @Post('jobs/:id/finish')
    finish(@Param('id', ParseIntPipe) id: number, @Body('operatorName') operatorName?: string) {
        return this.svc.finishJob(id, operatorName);
    }

    @Post('jobs/:id/pickup')
    pickup(@Param('id', ParseIntPipe) id: number) {
        return this.svc.pickupJob(id);
    }

    @Post('jobs/bulk-pickup')
    bulkPickup(@Body() body: { ids: number[]; branchId?: number | null }) {
        return this.svc.bulkPickup(body?.ids ?? [], body?.branchId);
    }

    @Post('jobs/:id/notes')
    notes(@Param('id', ParseIntPipe) id: number, @Body('notes') notes: string) {
        return this.svc.updateNotes(id, notes);
    }
}
