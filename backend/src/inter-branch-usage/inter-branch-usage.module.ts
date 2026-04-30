import { Module } from '@nestjs/common';
import { InterBranchUsageService } from './inter-branch-usage.service';
import { InterBranchUsageController } from './inter-branch-usage.controller';

@Module({
    controllers: [InterBranchUsageController],
    providers: [InterBranchUsageService],
})
export class InterBranchUsageModule { }
