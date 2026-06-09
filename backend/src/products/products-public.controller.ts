import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ProductsService } from './products.service';

@Controller('products/public')
export class ProductsPublicController {
    constructor(private readonly productsService: ProductsService) { }

    @Get()
    findAllPublic() {
        return this.productsService.findAllPublicSafe();
    }

    /** Produk terlaris (paling banyak diorder) — untuk blok landing. */
    @Get('best-sellers')
    bestSellers(@Query('limit') limit?: string) {
        const n = limit ? parseInt(limit, 10) : 10;
        return this.productsService.bestSellers(Number.isFinite(n) ? n : 10);
    }

    @Get(':id')
    findOnePublic(@Param('id', ParseIntPipe) id: number) {
        return this.productsService.findOnePublic(id);
    }
}
