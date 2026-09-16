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
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  ForbiddenException,
  Req,
  Res,
  ParseIntPipe,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import type { Response } from 'express';
import { extname } from 'path';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentBranch } from '../common/branch-context.decorator';
import type { BranchContext } from '../common/branch-context.decorator';
import { compressImage } from '../common/utils/compress-image.util';
import { TaskBoardService } from './task-board.service';

// Penyimpanan lampiran gambar tugas — sama pola dengan upload produk.
const taskImageStorage = diskStorage({
  destination: './public/uploads',
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `task-${uniqueSuffix}${extname(file.originalname)}`);
  },
});
const taskImageFilter = (_req: any, file: any, cb: any) => {
  if (!file.originalname.toLowerCase().match(/\.(jpg|jpeg|jfif|png|gif|webp)$/))
    return cb(new BadRequestException('Hanya berkas gambar yang diizinkan.'), false);
  cb(null, true);
};
import {
  CreateScheduleDto,
  UpdateScheduleDto,
  CreateTaskItemDto,
  UpdateTaskItemDto,
  MoveTaskItemDto,
  CreateGroupDto,
  UpdateGroupDto,
  ShiftCheckinDto,
  CreateWarningDto,
  AckWarningsDto,
  SetTrialDto,
} from './task-board.dto';
import { TaskPiketService } from './task-piket.service';
import { sendPiketPdf } from './piket-pdf.render';

@UseGuards(JwtAuthGuard)
@Controller('task-board')
export class TaskBoardController {
  constructor(
    private readonly svc: TaskBoardService,
    private readonly piket: TaskPiketService,
  ) {}

  // Piket harian — selalu data milik user yang login (bukan orang lain).
  @Get('my-day')
  myDay(@Req() req: any) {
    return this.piket.myDay(req.user.userId);
  }

  @Post('checkin')
  checkin(@Req() req: any, @Body() dto: ShiftCheckinDto) {
    return this.piket.checkin(req.user.userId, dto.shift);
  }

  @Get('warnings/mine')
  myWarnings(@Req() req: any) {
    return this.piket.myWarnings(req.user.userId);
  }

  @Post('warnings/ack')
  ackWarnings(@Req() req: any, @Body() dto: AckWarningsDto) {
    return this.piket.ackWarnings(req.user.userId, dto.ids);
  }

  @Get('reminders/mine')
  myReminders(@Req() req: any) {
    return this.piket.myUpcoming(req.user.userId);
  }

  @Get('today/mine')
  myToday(@Req() req: any) {
    return this.piket.myToday(req.user.userId);
  }

  // Papan piket — semua karyawan boleh melihat (tanpa teguran/catatan pribadi)
  @Get('board')
  board(@CurrentBranch() ctx: BranchContext) {
    return this.piket.piketBoard(ctx.branchId);
  }

  // PDF jadwal piket — dibuat otomatis dari jadwal & giliran terbaru (semua yang login)
  @Get('board/pdf')
  async boardPdf(@CurrentBranch() ctx: BranchContext, @Res() res: Response) {
    sendPiketPdf(res, await this.piket.piketPdf(ctx.branchId));
  }

  @Get('trial')
  async trial() {
    return { trialUntil: await this.piket.trialUntil() };
  }

  @Patch('trial')
  setTrial(@CurrentBranch() ctx: BranchContext, @Body() dto: SetTrialDto) {
    return this.piket.setTrial(ctx, dto.until ?? null);
  }

  // Pantau & tegur — owner/manajer (dicek di service)
  @Post('warnings')
  createWarning(
    @CurrentBranch() ctx: BranchContext,
    @Body() dto: CreateWarningDto,
    @Req() req: any,
  ) {
    return this.piket.createWarning(ctx, dto, req.user.userId);
  }

  @Get('monitor')
  monitor(@CurrentBranch() ctx: BranchContext, @Query('date') date?: string) {
    return this.piket.monitor(ctx, date);
  }

  @Get('monitor/recap')
  recap(@CurrentBranch() ctx: BranchContext, @Query('month') month?: string) {
    return this.piket.recap(ctx, month);
  }

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

  // Upload lampiran gambar tugas (multi, maks 6) → kembalikan URL relatif.
  // Owner/Manajer saja (sama dg yang boleh membuat tugas).
  @Post('upload-images')
  @UseInterceptors(
    FilesInterceptor('images', 6, {
      storage: taskImageStorage,
      fileFilter: taskImageFilter,
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadImages(
    @CurrentBranch() ctx: BranchContext,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!this.svc.canAssign(ctx))
      throw new ForbiddenException('Hanya owner/manajer yang boleh melampirkan gambar tugas.');
    if (!files || files.length === 0)
      throw new BadRequestException('Tidak ada berkas gambar.');
    await Promise.all(files.map((f) => compressImage(f.path)));
    return { urls: files.map((f) => `/uploads/${f.filename}`) };
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
