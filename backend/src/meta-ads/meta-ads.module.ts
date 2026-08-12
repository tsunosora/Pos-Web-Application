import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WhatsappCloudModule } from '../whatsapp-cloud/whatsapp-cloud.module';
import { MetaAdsService } from './meta-ads.service';
import { MetaAdsController } from './meta-ads.controller';

// WhatsappCloudModule meng-export CloudApiService → reuse token WA (satu kredensial).
@Module({
    imports: [PrismaModule, WhatsappCloudModule],
    controllers: [MetaAdsController],
    providers: [MetaAdsService],
    exports: [MetaAdsService],
})
export class MetaAdsModule {}
