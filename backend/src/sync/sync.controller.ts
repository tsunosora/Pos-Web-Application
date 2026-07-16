import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentBranch } from '../common/branch-context.decorator';
import type { BranchContext } from '../common/branch-context.decorator';
import { SyncService } from './sync.service';
import type { PushBody } from './dto';

@UseGuards(JwtAuthGuard)
@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  // GET /sync/pull?since=<ISO>&entities=products,customers
  // since kosong → snapshot penuh. Scope stok per cabang mengikuti X-Branch-Id/JWT.
  @Get('pull')
  pull(
    @CurrentBranch() branchCtx: BranchContext,
    @Query('since') since?: string,
    @Query('entities') entities?: string,
  ) {
    return this.syncService.pull(branchCtx, since, entities);
  }

  // POST /sync/push  body: { ops: [{ clientId, type, payload }] }
  @Post('push')
  push(@Body() body: PushBody, @CurrentBranch() branchCtx: BranchContext) {
    return this.syncService.push(branchCtx, body?.ops ?? []);
  }
}
