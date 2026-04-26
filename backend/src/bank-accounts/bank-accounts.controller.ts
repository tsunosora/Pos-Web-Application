import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { BankAccountsService } from './bank-accounts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentBranch } from '../common/branch-context.decorator';
import type { BranchContext } from '../common/branch-context.decorator';

@Controller('bank-accounts')
@UseGuards(JwtAuthGuard)
export class BankAccountsController {
    constructor(private readonly bankAccountsService: BankAccountsService) { }

    @Get()
    findAll(@CurrentBranch() branchCtx: BranchContext) {
        return this.bankAccountsService.findAll(branchCtx);
    }

    @Post()
    create(@Body() data: any, @CurrentBranch() branchCtx: BranchContext) {
        return this.bankAccountsService.create(data, branchCtx);
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() data: any, @CurrentBranch() branchCtx: BranchContext) {
        return this.bankAccountsService.update(+id, data, branchCtx);
    }

    @Patch(':id/reset-balance')
    resetBalance(
        @Param('id') id: string,
        @Body() body: { newBalance: number },
        @CurrentBranch() branchCtx: BranchContext,
    ) {
        return this.bankAccountsService.resetBalance(+id, body.newBalance, branchCtx);
    }

    @Delete(':id')
    remove(@Param('id') id: string, @CurrentBranch() branchCtx: BranchContext) {
        return this.bankAccountsService.remove(+id, branchCtx);
    }
}
