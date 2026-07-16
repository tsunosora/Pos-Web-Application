import { Module } from '@nestjs/common';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { TransactionsModule } from '../transactions/transactions.module';

// TransactionsModule mengekspor TransactionsService → push transaksi offline REUSE
// jalur create yang sama (invoice server-side + potong stok delta + cashflow).
@Module({
  imports: [TransactionsModule],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
