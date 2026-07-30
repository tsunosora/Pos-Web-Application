import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query, ParseIntPipe, ForbiddenException } from '@nestjs/common';
import { HppService } from './hpp.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentBranch } from '../common/branch-context.decorator';
import type { BranchContext } from '../common/branch-context.decorator';

@UseGuards(JwtAuthGuard)
@Controller('hpp')
export class HppController {
    constructor(private readonly hppService: HppService) { }

    private assertOwner(ctx: BranchContext) {
        if (!ctx?.isOwner) {
            throw new ForbiddenException('Hanya owner yang boleh mengakses ringkasan HPP.');
        }
    }

    @Post()
    create(@Body() data: any) {
        return this.hppService.create(data);
    }

    // Ringkasan rumus HPP tiap produk (owner-only). HARUS sebelum @Get(':id').
    @Get('overview')
    getOverview(
        @CurrentBranch() ctx: BranchContext,
        @Query('categoryId') categoryId?: string,
        @Query('includeArchived') includeArchived?: string,
    ) {
        this.assertOwner(ctx);
        return this.hppService.getProductHppOverview({
            categoryId: categoryId ? Number(categoryId) : undefined,
            includeArchived: includeArchived === 'true' || includeArchived === '1',
        });
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
