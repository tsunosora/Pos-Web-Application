import { Module } from '@nestjs/common';
import { BranchInboxService } from './branch-inbox.service';
import { BranchInboxController } from './branch-inbox.controller';

@Module({
    controllers: [BranchInboxController],
    providers: [BranchInboxService],
    exports: [BranchInboxService],
})
export class BranchInboxModule { }
