import { Controller, Get, Post, Body, Patch, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { InvoiceService } from './invoice.service';
import { Prisma, InvoiceStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('invoices') // Plural to match typical REST style. The generator built 'invoice' but we use 'invoices' here.
export class InvoiceController {
    constructor(private readonly invoiceService: InvoiceService) { }

    @Post()
    create(@Body() createData: Prisma.InvoiceCreateInput) {
        return this.invoiceService.create(createData);
    }

    @Get()
    findAll() {
        return this.invoiceService.findAll();
    }

    @Patch(':id/status')
    updateStatus(
        @Param('id', ParseIntPipe) id: number,
        @Body('status') status: InvoiceStatus,
    ) {
        return this.invoiceService.updateStatus(id, status);
    }
}
