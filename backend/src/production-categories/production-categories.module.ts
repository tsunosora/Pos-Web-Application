import { Module } from '@nestjs/common';
import { ProductionCategoriesController } from './production-categories.controller';
import { ProductionCategoriesService } from './production-categories.service';

@Module({
    controllers: [ProductionCategoriesController],
    providers: [ProductionCategoriesService],
})
export class ProductionCategoriesModule {}
