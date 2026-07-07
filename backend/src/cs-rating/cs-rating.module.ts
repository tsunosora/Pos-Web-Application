import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CsRatingService } from './cs-rating.service';
import { CsRatingController } from './cs-rating.controller';
import { CsRatingPublicController } from './cs-rating-public.controller';

@Module({
    imports: [PrismaModule],
    controllers: [CsRatingController, CsRatingPublicController],
    providers: [CsRatingService],
})
export class CsRatingModule {}
