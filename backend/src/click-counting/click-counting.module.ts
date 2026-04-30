import { Module } from '@nestjs/common';
import { ClickCountingService } from './click-counting.service';
import { ClickCountingController } from './click-counting.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ClickCountingController],
  providers: [ClickCountingService],
  // Export supaya ProductionModule (public + PIN gated /cetak) bisa pakai
  // service ini untuk endpoint rekonsiliasi operator (input counter + upload foto).
  exports: [ClickCountingService],
})
export class ClickCountingModule {}
