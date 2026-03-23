import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query, ParseIntPipe } from '@nestjs/common';
import { HppService } from './hpp.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('hpp')
export class HppController {
    constructor(private readonly hppService: HppService) { }

    @Post()
    create(@Body() data: any) {
        return this.hppService.create(data);
    }

    @Get()
    findAll(@Query('variantId') variantId?: string) {
        return this.hppService.findAll(variantId ? parseInt(variantId) : undefined);
    }

    @Get('by-variant/:variantId')
    findByVariant(@Param('variantId', ParseIntPipe) variantId: number) {
        return this.hppService.findByVariant(variantId);
    }

    @Get('by-product/:productId')
    findByProduct(@Param('productId', ParseIntPipe) productId: number) {
        return this.hppService.findByProduct(productId);
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.hppService.findOne(+id);
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() data: any) {
        return this.hppService.update(+id, data);
    }

    @Post(':id/apply-to-variant')
    applyToVariant(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: { hppPerUnit: number }
    ) {
        return this.hppService.applyToVariant(id, body.hppPerUnit);
    }

    @Post(':id/apply-variants-custom')
    applyVariantsCustom(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: { variants: { variantId: number; hppPerUnit: number; scaleFactor: number }[] }
    ) {
        return this.hppService.applyVariantsCustom(id, body.variants);
    }

    @Post(':id/apply-to-variants')
    applyToVariants(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: { variantIds: number[]; hppPerUnit: number }
    ) {
        return this.hppService.applyToVariants(id, body.variantIds, body.hppPerUnit);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.hppService.remove(+id);
    }
}
