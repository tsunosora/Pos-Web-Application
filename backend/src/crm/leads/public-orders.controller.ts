import { Body, Controller, Post } from '@nestjs/common';
import { LeadsService } from './leads.service';
import type { LeadItemDto } from './leads.dto';

interface PublicOrderDto {
    name: string;
    phone?: string;
    address?: string;
    note?: string;
    items?: LeadItemDto[];
    branchId?: number; // Cabang/lokasi cetak yang dipilih customer di website (opsional)
}

/** Endpoint publik (tanpa auth) untuk order online dari website customer. */
@Controller('orders/public')
export class PublicOrdersController {
    constructor(private readonly leads: LeadsService) {}

    @Post()
    create(@Body() body: PublicOrderDto) {
        return this.leads.createPublicOrder(body);
    }
}
