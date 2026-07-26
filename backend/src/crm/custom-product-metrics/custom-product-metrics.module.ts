import { Module } from '@nestjs/common';
import { CustomProductMetricsService } from './custom-product-metrics.service';
import { CustomProductMetricsController } from './custom-product-metrics.controller';

@Module({
    controllers: [CustomProductMetricsController],
    providers: [CustomProductMetricsService],
    exports: [CustomProductMetricsService],
})
export class CustomProductMetricsModule {}
