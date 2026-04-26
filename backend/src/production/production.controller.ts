import { Controller, Get, Post, Body, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ProductionService } from './production.service';

// All endpoints are public (no JWT) — gated by operator PIN on client side
@Controller('production')
export class ProductionController {
    constructor(private readonly productionService: ProductionService) {}

    @Get('jobs')
    getJobs(
        @Query('status') status?: string,
        @Query('priority') priority?: string,
        @Query('branchId') branchId?: string,
    ) {
        return this.productionService.getJobs(status, priority, branchId ? parseInt(branchId) : undefined);
    }

    @Get('rolls')
    getRolls() {
        return this.productionService.getRolls();
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
}
