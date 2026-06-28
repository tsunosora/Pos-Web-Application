import { Module } from '@nestjs/common';
import { FixedExpensesService } from './fixed-expenses.service';
import { FixedExpensesController } from './fixed-expenses.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [FixedExpensesController],
    providers: [FixedExpensesService],
})
export class FixedExpensesModule {}
