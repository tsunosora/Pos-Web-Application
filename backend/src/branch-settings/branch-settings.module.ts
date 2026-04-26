import { Module } from '@nestjs/common';
import { BranchSettingsController } from './branch-settings.controller';
import { BranchSettingsService } from './branch-settings.service';

@Module({
    controllers: [BranchSettingsController],
    providers: [BranchSettingsService],
})
export class BranchSettingsModule { }
