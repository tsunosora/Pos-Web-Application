import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { BankAccountsService } from './bank-accounts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('bank-accounts')
@UseGuards(JwtAuthGuard)
export class BankAccountsController {
    constructor(private readonly bankAccountsService: BankAccountsService) { }

    @Get()
    findAll() {
        return this.bankAccountsService.findAll();
    }

    @Post()
    create(@Body() data: any) {
        return this.bankAccountsService.create(data);
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() data: any) {
        return this.bankAccountsService.update(+id, data);
    }

    @Patch(':id/reset-balance')
    resetBalance(@Param('id') id: string, @Body() body: { newBalance: number }) {
        return this.bankAccountsService.resetBalance(+id, body.newBalance);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.bankAccountsService.remove(+id);
    }
}
