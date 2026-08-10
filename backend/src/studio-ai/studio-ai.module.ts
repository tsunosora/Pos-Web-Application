import { Module } from '@nestjs/common';
import { StudioAiController } from './studio-ai.controller';
import { StudioAiService } from './studio-ai.service';

@Module({
  controllers: [StudioAiController],
  providers: [StudioAiService],
})
export class StudioAiModule {}
