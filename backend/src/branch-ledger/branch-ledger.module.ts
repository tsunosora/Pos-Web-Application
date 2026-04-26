import { Module } from '@nestjs/common';
import { BranchLedgerService } from './branch-ledger.service';
import { BranchLedgerController } from './branch-ledger.controller';

@Module({
    controllers: [BranchLedgerController],
    providers: [BranchLedgerService],
    exports: [BranchLedgerService],
})
export class BranchLedgerModule { }
