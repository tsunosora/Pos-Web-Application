import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  ParseIntPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentBranch } from '../common/branch-context.decorator';
import type { BranchContext } from '../common/branch-context.decorator';
import { TaskBoardService } from './task-board.service';
import {
  CreateScheduleDto,
  UpdateScheduleDto,
  CreateTaskItemDto,
  UpdateTaskItemDto,
  MoveTaskItemDto,
  CreateGroupDto,
  UpdateGroupDto,
} from './task-board.dto';

@UseGuards(JwtAuthGuard)
@Controller('task-board')
export class TaskBoardController {
  constructor(private readonly svc: TaskBoardService) {}

  // Schedules (jadwal berulang) — manager only (dicek di service)
  @Get('schedules')
  listSchedules(@CurrentBranch() ctx: BranchContext) {
    return this.svc.listSchedules(ctx);
  }

  @Post('schedules')
  createSchedule(
    @CurrentBranch() ctx: BranchContext,
    @Body() dto: CreateScheduleDto,
    @Req() req: any,
  ) {
    return this.svc.createSchedule(ctx, dto, req.user.userId);
  }

  @Patch('schedules/:id')
  updateSchedule(
    @CurrentBranch() ctx: BranchContext,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateScheduleDto,
  ) {
    return this.svc.updateSchedule(ctx, id, dto);
  }

  @Delete('schedules/:id')
  deleteSchedule(
    @CurrentBranch() ctx: BranchContext,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.svc.deleteSchedule(ctx, id);
  }

  @Post('schedules/generate-now')
  generateNow(@CurrentBranch() ctx: BranchContext) {
    return this.svc.generateNow(ctx);
  }

  // Board items
  @Get('items')
  listItems(
    @CurrentBranch() ctx: BranchContext,
    @Req() req: any,
    @Query('mine') mine?: string,
    @Query('assigneeId') assigneeId?: string,
  ) {
    return this.svc.listItems(ctx, {
      mine: mine === '1' || mine === 'true',
      userId: req.user.userId,
      assigneeId: assigneeId ? Number(assigneeId) : undefined,
    });
  }

  @Post('items')
  createItem(
    @CurrentBranch() ctx: BranchContext,
    @Body() dto: CreateTaskItemDto,
    @Req() req: any,
  ) {
    return this.svc.createItem(ctx, dto, req.user.userId);
  }

  @Patch('items/:id')
  updateItem(
    @CurrentBranch() ctx: BranchContext,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTaskItemDto,
    @Req() req: any,
  ) {
    return this.svc.updateItem(ctx, id, dto, req.user.userId);
  }

  @Patch('items/:id/move')
  moveItem(
    @CurrentBranch() ctx: BranchContext,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: MoveTaskItemDto,
    @Req() req: any,
  ) {
    return this.svc.moveItem(ctx, id, dto, req.user.userId);
  }

  @Delete('items/:id')
  deleteItem(
    @CurrentBranch() ctx: BranchContext,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.svc.deleteItem(ctx, id);
  }

  @Get('summary')
  summary(@CurrentBranch() ctx: BranchContext) {
    return this.svc.summary(ctx);
  }

  // Grup tim kustom
  @Get('groups')
  listGroups(@CurrentBranch() ctx: BranchContext) {
    return this.svc.listGroups(ctx);
  }

  @Post('groups')
  createGroup(
    @CurrentBranch() ctx: BranchContext,
    @Body() dto: CreateGroupDto,
    @Req() req: any,
  ) {
    return this.svc.createGroup(ctx, dto, req.user.userId);
  }

  @Patch('groups/:id')
  updateGroup(
    @CurrentBranch() ctx: BranchContext,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateGroupDto,
  ) {
    return this.svc.updateGroup(ctx, id, dto);
  }

  @Delete('groups/:id')
  deleteGroup(
    @CurrentBranch() ctx: BranchContext,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.svc.deleteGroup(ctx, id);
  }
}
