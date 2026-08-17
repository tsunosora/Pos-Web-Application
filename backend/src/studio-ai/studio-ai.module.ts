import { Module } from '@nestjs/common';
import { StudioAiController } from './studio-ai.controller';
import { StudioAiService } from './studio-ai.service';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [ProductsModule],
  controllers: [StudioAiController],
  providers: [StudioAiService],
})
export class StudioAiModule {}
