import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsPublicController } from './products-public.controller';
import { ProductsService } from './products.service';

@Module({
  controllers: [ProductsPublicController, ProductsController],
  providers: [ProductsService]
})
export class ProductsModule {}
