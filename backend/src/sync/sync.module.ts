import { Module } from '@nestjs/common';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { SyncAuthGuard } from './sync-auth.guard';
import { TransactionsModule } from '../transactions/transactions.module';
import { StockPurchasesService } from '../stock-purchases/stock-purchases.service';
import { StockTransfersService } from '../stock-transfers/stock-transfers.service';
import { StockOpnameService } from '../stock-opname/stock-opname.service';

// TransactionsModule mengekspor TransactionsService → push transaksi offline REUSE
// jalur create yang sama (invoice server-side + potong stok delta + cashflow).
// Service stok (purchase/transfer/opname) hanya bergantung PrismaService (global),
// jadi di-provide langsung agar applyOp bisa memutar ulang pembelian/opname/transfer.
@Module({
  imports: [TransactionsModule],
  controllers: [SyncController],
  providers: [
    SyncService,
    SyncAuthGuard,
    StockPurchasesService,
    StockTransfersService,
    StockOpnameService,
  ],
})
export class SyncModule {}
