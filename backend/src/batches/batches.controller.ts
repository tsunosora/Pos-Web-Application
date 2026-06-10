import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, UseGuards } from '@nestjs/common';
import { BatchesService } from './batches.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentBranch } from '../common/branch-context.decorator';
import type { BranchContext } from '../common/branch-context.decorator';

@UseGuards(JwtAuthGuard)
@Controller('batches')
export class BatchesController {
    constructor(private readonly batchesService: BatchesService) { }

    @Post()
    create(@Body() createBatchDto: any, @CurrentBranch() branchCtx: BranchContext) {
        return this.batchesService.create(createBatchDto, branchCtx);
    }

    @Get()
    findAll(@CurrentBranch() branchCtx: BranchContext) {
        return this.batchesService.findAll(branchCtx);
    }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number, @CurrentBranch() branchCtx: BranchContext) {
        return this.batchesService.findOne(id, branchCtx);
    }

    @Patch(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() updateBatchDto: any, @CurrentBranch() branchCtx: BranchContext) {
        return this.batchesService.update(id, updateBatchDto, branchCtx);
    }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number, @CurrentBranch() branchCtx: BranchContext) {
        return this.batchesService.remove(id, branchCtx);
    }
}
