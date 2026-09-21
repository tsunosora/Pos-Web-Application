import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { BankAccountsService } from './bank-accounts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ManagerGuard } from '../auth/role-groups';
import { CurrentBranch } from '../common/branch-context.decorator';
import type { BranchContext } from '../common/branch-context.decorator';

// GET terbuka (dipakai POS/DP/kas saat memilih rekening); mengubah rekening &
// mereset saldo hanya setingkat manajer (T-14).
@Controller('bank-accounts')
@UseGuards(JwtAuthGuard)
export class BankAccountsController {
    constructor(private readonly bankAccountsService: BankAccountsService) { }

    @Get()
    findAll(@CurrentBranch() branchCtx: BranchContext) {
        return this.bankAccountsService.findAll(branchCtx);
    }

    @Post()
    @UseGuards(ManagerGuard)
    create(@Body() data: any, @CurrentBranch() branchCtx: BranchContext) {
        return this.bankAccountsService.create(data, branchCtx);
    }

    @Patch(':id')
    @UseGuards(ManagerGuard)
    update(@Param('id') id: string, @Body() data: any, @CurrentBranch() branchCtx: BranchContext) {
        return this.bankAccountsService.update(+id, data, branchCtx);
    }

    @Patch(':id/reset-balance')
    @UseGuards(ManagerGuard)
    resetBalance(
        @Param('id') id: string,
        @Body() body: { newBalance: number },
        @CurrentBranch() branchCtx: BranchContext,
    ) {
        return this.bankAccountsService.resetBalance(+id, body.newBalance, branchCtx);
    }

    @Delete(':id')
    @UseGuards(ManagerGuard)
    remove(@Param('id') id: string, @CurrentBranch() branchCtx: BranchContext) {
        return this.bankAccountsService.remove(+id, branchCtx);
    }
}
