import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OwnerGuard } from '../auth/role-groups';
import { CurrentBranch } from '../common/branch-context.decorator';
import type { BranchContext } from '../common/branch-context.decorator';
import { SyncService, type SyncCaller } from './sync.service';
import { SyncAuthGuard } from './sync-auth.guard';
import type { PushBody } from './dto';

// Perangkat (req.device dari SyncAuthGuard) vs user JWT.
function callerOf(req: any): SyncCaller {
  if (req?.device) return { isDevice: true, userId: null };
  const userId = Number(req?.user?.userId);
  return {
    isDevice: false,
    userId: Number.isInteger(userId) && userId > 0 ? userId : null,
    roleName: req?.user?.roleName ?? null,
    menuAccess: req?.user?.menuAccess ?? null,
  };
}

@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  // GET /sync/pull?since=<ISO>&entities=products,customers
  // Auth: x-device-token (perangkat) atau JWT. Scope cabang dari device/JWT.
  @UseGuards(SyncAuthGuard)
  @Get('pull')
  pull(
    @CurrentBranch() branchCtx: BranchContext,
    @Req() req: any,
    @Query('since') since?: string,
    @Query('entities') entities?: string,
  ) {
    return this.syncService.pull(branchCtx, since, entities, callerOf(req));
  }

  // POST /sync/push  body: { ops: [{ clientId, type, payload }] }
  @UseGuards(SyncAuthGuard)
  @Post('push')
  push(@Body() body: PushBody, @CurrentBranch() branchCtx: BranchContext, @Req() req: any) {
    return this.syncService.push(branchCtx, body?.ops ?? [], callerOf(req));
  }

  // POST /sync/register-device — hanya owner (JWT) → token device.
  @UseGuards(JwtAuthGuard, OwnerGuard)
  @Post('register-device')
  registerDevice(
    @CurrentBranch() branchCtx: BranchContext,
    @Body() body: { name?: string; branchId?: number | null },
  ) {
    return this.syncService.registerDevice(branchCtx, body ?? {});
  }
}
