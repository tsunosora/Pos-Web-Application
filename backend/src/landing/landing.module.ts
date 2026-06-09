import { Module } from '@nestjs/common';
import { LandingService } from './landing.service';
import { LandingController } from './landing.controller';

@Module({
    controllers: [LandingController],
    providers: [LandingService],
    exports: [LandingService],
})
export class LandingModule {}
