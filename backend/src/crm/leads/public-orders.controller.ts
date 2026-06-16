import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { PublicOrderThrottleGuard } from '../../common/public-order-throttle.guard';
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
    @UseGuards(PublicOrderThrottleGuard)
    create(@Body() body: PublicOrderDto) {
        return this.leads.createPublicOrder(body);
    }
}
