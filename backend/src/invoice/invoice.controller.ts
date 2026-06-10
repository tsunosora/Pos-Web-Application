import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { InvoiceService } from './invoice.service';
import { InvoiceStatus, InvoiceType } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentBranch } from '../common/branch-context.decorator';
import type { BranchContext } from '../common/branch-context.decorator';

@UseGuards(JwtAuthGuard)
@Controller('invoices')
export class InvoiceController {
    constructor(private readonly invoiceService: InvoiceService) { }

    @Post()
    create(@Body() createData: any, @CurrentBranch() branchCtx: BranchContext) {
        return this.invoiceService.create(createData, branchCtx);
    }

    @Get()
    findAll(@CurrentBranch() branchCtx: BranchContext, @Query('type') type?: InvoiceType) {
        return this.invoiceService.findAll(type, branchCtx);
    }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number, @CurrentBranch() branchCtx: BranchContext) {
        return this.invoiceService.findOne(id, branchCtx);
    }

    @Patch(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() data: any, @CurrentBranch() branchCtx: BranchContext) {
        return this.invoiceService.update(id, data, branchCtx);
    }

    @Patch(':id/status')
    updateStatus(
        @Param('id', ParseIntPipe) id: number,
        @Body('status') status: InvoiceStatus,
        @CurrentBranch() branchCtx: BranchContext,
    ) {
        return this.invoiceService.updateStatus(id, status, branchCtx);
    }

    @Patch(':id/type')
    updateType(
        @Param('id', ParseIntPipe) id: number,
        @Body('type') type: InvoiceType,
        @CurrentBranch() branchCtx: BranchContext,
    ) {
        return this.invoiceService.updateType(id, type, branchCtx);
    }

    @Post(':id/convert-to-invoice')
    convertToInvoice(@Param('id', ParseIntPipe) id: number, @CurrentBranch() branchCtx: BranchContext) {
        return this.invoiceService.convertToInvoice(id, branchCtx);
    }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number, @CurrentBranch() branchCtx: BranchContext) {
        return this.invoiceService.remove(id, branchCtx);
    }
}
