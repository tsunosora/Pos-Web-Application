import {
    Controller, Get, Post, Body, Patch, Param, Delete,
    ParseIntPipe, UseGuards, UseInterceptors, UploadedFile,
    UploadedFiles, BadRequestException, Put, Query, ForbiddenException, Req,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { ProductsService } from './products.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ManagerGuard, Menu, MenuGuard, isManagerLevelRole } from '../auth/role-groups';
import { compressImage } from '../common/utils/compress-image.util';
import { CurrentBranch } from '../common/branch-context.decorator';
import type { BranchContext } from '../common/branch-context.decorator';

const imageStorage = diskStorage({
    destination: './public/uploads',
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = extname(file.originalname);
        cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
    },
});

const imageFilter = (req: any, file: any, cb: any) => {
    if (!file.originalname.toLowerCase().match(/\.(jpg|jpeg|jfif|png|gif|webp)$/)) {
        return cb(new BadRequestException('Only image files are allowed!'), false);
    }
    cb(null, true);
};

// Tulis produk/harga/varian = pemegang menu Inventori (Operator & setingkat manajer). Dulu cukup
// login: kasir/desainer bisa mengubah harga & HPP lewat API. Hitung komposit (dipakai kasir) bebas.
@UseGuards(JwtAuthGuard, MenuGuard)
@Controller('products')
export class ProductsController {
    constructor(private readonly productsService: ProductsService) { }

    // Stok awal varian baru dicatat ke cabang aktif (lihat ProductsService.cekStokAwal).
    @Menu('/inventory')
    @Post()
    create(@Body() createProductDto: any, @CurrentBranch() branchCtx: BranchContext) {
        return this.productsService.create(createProductDto, branchCtx.branchId ?? null);
    }

    @Menu('/inventory')
    @Post('bulk-import')
    bulkImport(@Body() payload: any, @CurrentBranch() branchCtx: BranchContext) {
        return this.productsService.bulkImport(payload, branchCtx.branchId ?? null);
    }

    @Menu('/inventory')
    @Delete('bulk')
    @UseGuards(ManagerGuard)
    bulkRemove(@Body() payload: { ids: number[] }) {
        return this.productsService.bulkRemove(payload.ids);
    }

    @Get()
    findAll(@CurrentBranch() branchCtx: BranchContext) {
        return this.productsService.findAll(branchCtx);
    }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number, @CurrentBranch() branchCtx: BranchContext) {
        return this.productsService.findOne(id, branchCtx);
    }

    // === Produk COMPOSITE (produk konfigurasi) ===
    @Get(':id/composite/options')
    getCompositeOptions(@Param('id', ParseIntPipe) id: number) {
        return this.productsService.getCompositeOptions(id);
    }

    @Post(':id/composite/compute')
    computeComposite(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: { selectedOptions: Record<string, any> },
    ) {
        return this.productsService.computeComposite(id, body?.selectedOptions ?? {});
    }

    @Menu('/inventory')
    @Patch(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() updateProductDto: any, @Req() req: any, @CurrentBranch() branchCtx: BranchContext) {
        // Menghapus varian lewat form produk = setingkat manajer (sama dgn DELETE varian/produk).
        if (updateProductDto?.deletedVariantIds?.length && !isManagerLevelRole(req.user?.roleName)) {
            throw new ForbiddenException('Menghapus varian hanya untuk owner/manajer.');
        }
        return this.productsService.update(id, updateProductDto, branchCtx.branchId ?? null);
    }

    @Menu('/inventory')
    @Delete(':id')
    @UseGuards(ManagerGuard)
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.productsService.remove(id);
    }

    // ── Variant endpoints ───────────────────────────────────────────────────

    @Menu('/inventory')
    @Post(':id/variants')
    addVariant(@Param('id', ParseIntPipe) id: number, @Body() variantData: any, @CurrentBranch() branchCtx: BranchContext) {
        return this.productsService.addVariant(id, variantData, branchCtx.branchId ?? null);
    }

    @Menu('/inventory')
    @Patch('variants/:variantId')
    updateVariant(
        @Param('variantId', ParseIntPipe) variantId: number,
        @Body() variantData: any,
    ) {
        return this.productsService.updateVariant(variantId, variantData);
    }

    @Menu('/inventory')
    @Delete('variants/:variantId')
    @UseGuards(ManagerGuard)
    removeVariant(@Param('variantId', ParseIntPipe) variantId: number) {
        return this.productsService.removeVariant(variantId);
    }

    // ── Image upload endpoints ──────────────────────────────────────────────

    @Menu('/inventory')
    @Post(':id/upload-image')
    @UseInterceptors(FileInterceptor('image', {
        storage: imageStorage,
        fileFilter: imageFilter,
        limits: { fileSize: 5 * 1024 * 1024 },
    }))
    async uploadImage(
        @Param('id', ParseIntPipe) id: number,
        @UploadedFile() file: Express.Multer.File,
    ) {
        if (!file) throw new BadRequestException('Image file is required');
        await compressImage(file.path);
        const imageUrl = `/uploads/${file.filename}`;
        await this.productsService.updateImageUrl(id, imageUrl);
        return { message: 'Image uploaded successfully', imageUrl };
    }

    @Menu('/inventory')
    @Post(':id/upload-images')
    @UseInterceptors(FilesInterceptor('images', 4, {
        storage: imageStorage,
        fileFilter: imageFilter,
        limits: { fileSize: 5 * 1024 * 1024 },
    }))
    async uploadImages(
        @Param('id', ParseIntPipe) id: number,
        @UploadedFiles() files: Express.Multer.File[],
    ) {
        if (!files || files.length === 0) throw new BadRequestException('At least one image is required');
        await Promise.all(files.map(f => compressImage(f.path)));
        const imageUrls = files.map(f => `/uploads/${f.filename}`);
        await this.productsService.updateImageUrls(id, imageUrls);
        await this.productsService.updateImageUrl(id, imageUrls[0]);
        return { message: 'Images uploaded successfully', imageUrls };
    }

    @Menu('/inventory')
    @Post('variants/:variantId/upload-image')
    @UseInterceptors(FileInterceptor('image', {
        storage: imageStorage,
        fileFilter: imageFilter,
        limits: { fileSize: 5 * 1024 * 1024 },
    }))
    async uploadVariantImage(
        @Param('variantId', ParseIntPipe) variantId: number,
        @UploadedFile() file: Express.Multer.File,
    ) {
        if (!file) throw new BadRequestException('Image file is required');
        await compressImage(file.path);
        const variantImageUrl = `/uploads/${file.filename}`;
        await this.productsService.updateVariantImageUrl(variantId, variantImageUrl);
        return { message: 'Variant image uploaded successfully', variantImageUrl };
    }

    // ── Product Ingredient endpoints ────────────────────────────────────────

    @Menu('/inventory')
    @Post(':id/ingredients')
    addIngredient(@Param('id', ParseIntPipe) id: number, @Body() ingredientData: any) {
        return this.productsService.addIngredient(id, ingredientData);
    }

    @Menu('/inventory')
    @Patch(':id/ingredients/:ingId')
    updateIngredient(
        @Param('id', ParseIntPipe) id: number,
        @Param('ingId', ParseIntPipe) ingId: number,
        @Body() data: any,
    ) {
        return this.productsService.updateIngredient(ingId, data, id);
    }

    @Menu('/inventory')
    @Delete(':id/ingredients/:ingId')
    @UseGuards(ManagerGuard)
    removeIngredient(@Param('ingId', ParseIntPipe) ingId: number) {
        return this.productsService.removeIngredient(ingId);
    }

    // ── Variant Price Tier endpoints ────────────────────────────────────────

    @Get('variants/:variantId/price-tiers')
    getPriceTiers(@Param('variantId', ParseIntPipe) variantId: number) {
        return this.productsService.getPriceTiers(variantId);
    }

    @Menu('/inventory')
    @Put('variants/:variantId/price-tiers')
    replacePriceTiers(
        @Param('variantId', ParseIntPipe) variantId: number,
        @Body() body: { tiers: any[] },
    ) {
        return this.productsService.replacePriceTiers(variantId, body.tiers || []);
    }

    @Menu('/inventory')
    @Delete('variants/:variantId/price-tiers/:tierId')
    @UseGuards(ManagerGuard)
    removePriceTier(@Param('tierId', ParseIntPipe) tierId: number) {
        return this.productsService.removePriceTier(tierId);
    }

    // ── Variant Ingredient endpoints ────────────────────────────────────────

    @Get('variants/:variantId/variant-ingredients')
    getVariantIngredients(@Param('variantId', ParseIntPipe) variantId: number) {
        return this.productsService.getVariantIngredients(variantId);
    }

    @Menu('/inventory')
    @Put('variants/:variantId/variant-ingredients')
    replaceVariantIngredients(
        @Param('variantId', ParseIntPipe) variantId: number,
        @Body() body: { ingredients: any[] },
    ) {
        return this.productsService.replaceVariantIngredients(variantId, body.ingredients || []);
    }

    @Menu('/inventory')
    @Delete('variants/:variantId/variant-ingredients/:ingId')
    @UseGuards(ManagerGuard)
    removeVariantIngredient(@Param('ingId', ParseIntPipe) ingId: number) {
        return this.productsService.removeVariantIngredient(ingId);
    }

    // ── Stock History ───────────────────────────────────────────────────────

    @Get('variants/:variantId/stock-history')
    getVariantStockHistory(
        @Param('variantId', ParseIntPipe) variantId: number,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        return this.productsService.getVariantStockHistory(
            variantId,
            page ? parseInt(page) : 1,
            limit ? parseInt(limit) : 50,
        );
    }
}
