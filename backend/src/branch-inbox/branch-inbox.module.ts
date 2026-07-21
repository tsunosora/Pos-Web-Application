import { Module } from '@nestjs/common';
import { BranchInboxService } from './branch-inbox.service';
import { BranchInboxController } from './branch-inbox.controller';
import { WhatsappCloudModule } from '../whatsapp-cloud/whatsapp-cloud.module';

@Module({
    imports: [WhatsappCloudModule], // RemindersService untuk reminder "siap ambil"
    controllers: [BranchInboxController],
    providers: [BranchInboxService],
    exports: [BranchInboxService],
})
export class BranchInboxModule { }
