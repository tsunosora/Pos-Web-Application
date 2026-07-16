import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentBranch } from '../common/branch-context.decorator';
import type { BranchContext } from '../common/branch-context.decorator';
import { SyncService } from './sync.service';
import { SyncAuthGuard } from './sync-auth.guard';
import type { PushBody } from './dto';

@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  // GET /sync/pull?since=<ISO>&entities=products,customers
  // Auth: x-device-token (perangkat) atau JWT. Scope cabang dari device/JWT.
  @UseGuards(SyncAuthGuard)
  @Get('pull')
  pull(
    @CurrentBranch() branchCtx: BranchContext,
    @Query('since') since?: string,
    @Query('entities') entities?: string,
  ) {
    return this.syncService.pull(branchCtx, since, entities);
  }

  // POST /sync/push  body: { ops: [{ clientId, type, payload }] }
  @UseGuards(SyncAuthGuard)
  @Post('push')
  push(@Body() body: PushBody, @CurrentBranch() branchCtx: BranchContext) {
    return this.syncService.push(branchCtx, body?.ops ?? []);
  }

  // POST /sync/register-device — owner/admin daftarkan perangkat (JWT saja) → token device.
  @UseGuards(JwtAuthGuard)
  @Post('register-device')
  registerDevice(
    @CurrentBranch() branchCtx: BranchContext,
    @Body() body: { name?: string; branchId?: number | null },
  ) {
    return this.syncService.registerDevice(branchCtx, body ?? {});
  }
}
