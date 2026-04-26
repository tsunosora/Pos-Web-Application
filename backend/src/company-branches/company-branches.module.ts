import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CompanyBranchesService } from './company-branches.service';
import { CompanyBranchesController } from './company-branches.controller';

@Module({
    imports: [PrismaModule],
    controllers: [CompanyBranchesController],
    providers: [CompanyBranchesService],
    exports: [CompanyBranchesService],
})
export class CompanyBranchesModule {}
