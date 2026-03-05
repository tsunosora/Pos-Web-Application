import {
    Controller, Get, Post, Body, Patch, Param, Delete,
    ParseIntPipe, UseGuards, UseInterceptors, UploadedFile,
    UploadedFiles, BadRequestException
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { ProductsService } from './products.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

const imageStorage = diskStorage({
    destination: './public/uploads',
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = extname(file.originalname);
        cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
    },
});

const imageFilter = (req: any, file: any, cb: any) => {
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
        return cb(new BadRequestException('Only image files are allowed!'), false);
    }
    cb(null, true);
};

@UseGuards(JwtAuthGuard)
@Controller('products')
export class ProductsController {
    constructor(private readonly productsService: ProductsService) { }

    @Post()
    create(@Body() createProductDto: any) {
        return this.productsService.create(createProductDto);
    }

    @Get()
    findAll() {
        return this.productsService.findAll();
    }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.productsService.findOne(id);
    }

    @Patch(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() updateProductDto: any) {
        return this.productsService.update(id, updateProductDto);
    }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.productsService.remove(id);
    }

    // Variant endpoints
    @Post(':id/variants')
    addVariant(@Param('id', ParseIntPipe) id: number, @Body() variantData: any) {
        return this.productsService.addVariant(id, variantData);
    }

    @Patch('variants/:variantId')
    updateVariant(
        @Param('variantId', ParseIntPipe) variantId: number,
        @Body() variantData: any,
    ) {
        return this.productsService.updateVariant(variantId, variantData);
    }

    @Delete('variants/:variantId')
    removeVariant(@Param('variantId', ParseIntPipe) variantId: number) {
        return this.productsService.removeVariant(variantId);
    }

    // Single image upload (legacy)
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
        const imageUrl = `/uploads/${file.filename}`;
        await this.productsService.updateImageUrl(id, imageUrl);
        return { message: 'Image uploaded successfully', imageUrl };
    }

    // Multi-image upload (up to 4)
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
        const imageUrls = files.map(f => `/uploads/${f.filename}`);
        await this.productsService.updateImageUrls(id, imageUrls);
        // also set the first as the legacy imageUrl
        await this.productsService.updateImageUrl(id, imageUrls[0]);
        return { message: 'Images uploaded successfully', imageUrls };
    }

    // Variant image upload
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
        const variantImageUrl = `/uploads/${file.filename}`;
        await this.productsService.updateVariantImageUrl(variantId, variantImageUrl);
        return { message: 'Variant image uploaded successfully', variantImageUrl };
    }

    // Ingredient endpoints
    @Post(':id/ingredients')
    addIngredient(@Param('id', ParseIntPipe) id: number, @Body() ingredientData: any) {
        return this.productsService.addIngredient(id, ingredientData);
    }

    @Patch(':id/ingredients/:ingId')
    updateIngredient(
        @Param('ingId', ParseIntPipe) ingId: number,
        @Body() data: any,
    ) {
        return this.productsService.updateIngredient(ingId, data);
    }

    @Delete(':id/ingredients/:ingId')
    removeIngredient(@Param('ingId', ParseIntPipe) ingId: number) {
        return this.productsService.removeIngredient(ingId);
    }
}
