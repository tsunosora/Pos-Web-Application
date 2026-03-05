import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('customers')
export class CustomersController {
    constructor(private readonly customersService: CustomersService) { }

    @UseGuards(JwtAuthGuard)
    @Post()
    create(@Body() data: { name: string; phone?: string; address?: string }) {
        return this.customersService.create(data);
    }

    @UseGuards(JwtAuthGuard)
    @Get()
    findAll() {
        return this.customersService.findAll();
    }

    @UseGuards(JwtAuthGuard)
    @Patch(':id')
    update(@Param('id') id: string, @Body() data: { name?: string; phone?: string; address?: string }) {
        return this.customersService.update(+id, data);
    }

    @UseGuards(JwtAuthGuard)
    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.customersService.remove(+id);
    }
}
