import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { FollowUpsService } from './follow-ups.service';
import { FollowUpsController } from './follow-ups.controller';
import { FollowUpsCron } from './follow-ups.cron';

@Module({
    imports: [PrismaModule],
    controllers: [FollowUpsController],
    providers: [FollowUpsService, FollowUpsCron],
    exports: [FollowUpsService],
})
export class FollowUpsModule {}
