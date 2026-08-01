import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { BranchContext } from '../common/branch-context.decorator';
import { matchesOn, periodKeyFor } from './recurrence.util';
import {
  CreateScheduleDto,
  UpdateScheduleDto,
  CreateTaskItemDto,
  UpdateTaskItemDto,
  MoveTaskItemDto,
} from './task-board.dto';

@Injectable()
export class TaskBoardService {
  private readonly logger = new Logger('TaskBoardService');
  constructor(private prisma: PrismaService) {}
  private get db(): any {
    return this.prisma as any;
  }

  /** Cabang efektif kartu: kalau ada penerima spesifik, ikut cabang penerima
   *  (biar tugas muncul di papan orang itu). Kalau tidak, pakai fallback. */
  private async branchForAssignee(
    assigneeId: number | null | undefined,
    fallback: number | null,
  ): Promise<number | null> {
    if (assigneeId) {
      const u = await this.db.user.findUnique({
        where: { id: assigneeId },
        select: { branchId: true },
      });
      if (u?.branchId != null) return u.branchId;
    }
    return fallback;
  }

  private assertManager(ctx: BranchContext) {
    const r = String(ctx.roleName ?? '').toUpperCase();
    const ok =
      ctx.isOwner ||
      r === 'ADMIN' ||
      r.includes('MANAJER') ||
      r.includes('MANAGER') ||
      r.includes('SUPERVISOR') ||
      r.includes('KEPALA');
    if (!ok)
      throw new ForbiddenException(
        'Hanya owner/admin yang boleh mengelola jadwal tugas.',
      );
  }

  // ---- SCHEDULE (aturan berulang) ----
  listSchedules(ctx: BranchContext) {
    const where: any = {};
    if (!ctx.isOwner) where.branchId = ctx.branchId;
    else if (ctx.branchId != null) where.branchId = ctx.branchId;
    return this.db.taskSchedule.findMany({
      where,
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
      include: { assignee: { select: { id: true, name: true } } },
    });
  }

  async createSchedule(
    ctx: BranchContext,
    dto: CreateScheduleDto,
    userId: number,
  ) {
    this.assertManager(ctx);
    const fallback = ctx.isOwner
      ? (dto.branchId ?? ctx.branchId ?? null)
      : ctx.branchId;
    const branchId = await this.branchForAssignee(dto.assigneeId, fallback);
    const sched = await this.db.taskSchedule.create({
      data: {
        title: dto.title,
        description: dto.description ?? null,
        frequency: dto.frequency,
        daysOfWeek: dto.daysOfWeek ?? null,
        dayOfMonth: dto.dayOfMonth ?? null,
        skipWeekends: dto.skipWeekends ?? false,
        timeOfDay: dto.timeOfDay ?? null,
        priority: dto.priority ?? 'NORMAL',
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        assigneeId: dto.assigneeId ?? null,
        targetRole: dto.targetRole ?? null,
        branchId,
        createdById: userId,
        isActive: true,
      },
    });
    // ONCE → langsung buat 1 kartu hari ini
    if (dto.frequency === 'ONCE') {
      await this.materializeSchedule(sched, new Date());
    }
    return sched;
  }

  async updateSchedule(ctx: BranchContext, id: number, dto: UpdateScheduleDto) {
    this.assertManager(ctx);
    await this.getScheduleScoped(ctx, id);
    return this.db.taskSchedule.update({
      where: { id },
      data: {
        ...dto,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
    });
  }

  async deleteSchedule(ctx: BranchContext, id: number) {
    this.assertManager(ctx);
    await this.getScheduleScoped(ctx, id);
    return this.db.taskSchedule.delete({ where: { id } }); // cascade hapus TaskItem
  }

  private async getScheduleScoped(ctx: BranchContext, id: number) {
    const s = await this.db.taskSchedule.findUnique({ where: { id } });
    if (!s) throw new NotFoundException('Jadwal tidak ditemukan.');
    if (!ctx.isOwner && s.branchId !== ctx.branchId)
      throw new ForbiddenException('Bukan cabang Anda.');
    return s;
  }

  // ---- MATERIALISASI (dipakai cron & tombol "generate sekarang") ----
  /** Resolusi daftar assignee utk sebuah schedule (spesifik / per-role / null). */
  private async resolveAssignees(sched: any): Promise<(number | null)[]> {
    if (sched.assigneeId) return [sched.assigneeId];
    if (sched.targetRole) {
      const users = await this.db.user.findMany({
        where: {
          isActive: true,
          role: { name: { equals: sched.targetRole } },
          ...(sched.branchId != null ? { branchId: sched.branchId } : {}),
        },
        select: { id: true },
      });
      return users.length ? users.map((u: any) => u.id) : [];
    }
    return [null]; // satu kartu tak-ter-assign utk cabang
  }

  private async materializeSchedule(sched: any, date: Date): Promise<number> {
    const periodKey = periodKeyFor(date);
    const assignees = await this.resolveAssignees(sched);
    let created = 0;
    for (const assigneeId of assignees) {
      // Kartu ikut cabang penerima (untuk targetRole lintas-cabang tiap user
      // dapat kartu di cabangnya sendiri). Fallback = cabang schedule.
      const branchId = await this.branchForAssignee(assigneeId, sched.branchId);
      try {
        await this.db.taskItem.create({
          data: {
            scheduleId: sched.id,
            title: sched.title,
            description: sched.description,
            priority: sched.priority,
            status: 'TODO',
            periodKey,
            dueDate: this.dueDateFor(date, sched.timeOfDay),
            assigneeId,
            branchId,
            createdById: sched.createdById,
          },
        });
        created++;
      } catch (e: any) {
        if (e?.code !== 'P2002') throw e; // P2002 = sudah ada (idempoten) → lewati
      }
    }
    return created;
  }

  private dueDateFor(date: Date, timeOfDay?: string | null): Date {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    if (timeOfDay && /^\d{2}:\d{2}$/.test(timeOfDay)) {
      const [h, m] = timeOfDay.split(':').map(Number);
      d.setHours(h, m, 0, 0);
    } else {
      d.setHours(23, 59, 0, 0);
    }
    return d;
  }

  /** Trigger manual dari UI (manager only) → generate kartu hari ini. */
  generateNow(ctx: BranchContext) {
    this.assertManager(ctx);
    return this.generateDue(new Date());
  }

  /** Generate semua kartu jatuh tempo utk `date` (default hari ini). Idempoten. */
  async generateDue(
    date = new Date(),
  ): Promise<{ created: number; scanned: number }> {
    const schedules = await this.db.taskSchedule.findMany({
      where: { isActive: true, frequency: { not: 'ONCE' } },
    });
    let created = 0;
    for (const s of schedules) {
      if (matchesOn(s, date)) created += await this.materializeSchedule(s, date);
    }
    this.logger.log(
      `generateDue(${periodKeyFor(date)}): ${created} kartu dari ${schedules.length} jadwal`,
    );
    return { created, scanned: schedules.length };
  }

  // ---- BOARD (kartu) ----
  listItems(
    ctx: BranchContext,
    opts: { assigneeId?: number; mine?: boolean; userId?: number },
  ) {
    const where: any = {};
    if (opts.mine && opts.userId) {
      // "Tugas Saya": tugas milikku muncul apa pun cabangnya (assign lintas-cabang
      // tetap kelihatan oleh penerimanya).
      where.assigneeId = opts.userId;
    } else {
      if (!ctx.isOwner) where.branchId = ctx.branchId;
      else if (ctx.branchId != null) where.branchId = ctx.branchId;
      if (opts.assigneeId) where.assigneeId = opts.assigneeId;
    }
    return this.db.taskItem.findMany({
      where,
      orderBy: [{ status: 'asc' }, { index: 'asc' }, { dueDate: 'asc' }],
      include: { assignee: { select: { id: true, name: true } } },
    });
  }

  async createItem(ctx: BranchContext, dto: CreateTaskItemDto, userId: number) {
    this.assertManager(ctx);
    const fallback = ctx.isOwner
      ? (dto.branchId ?? ctx.branchId ?? null)
      : ctx.branchId;
    const branchId = await this.branchForAssignee(dto.assigneeId, fallback);
    return this.db.taskItem.create({
      data: {
        scheduleId: null,
        title: dto.title,
        description: dto.description ?? null,
        priority: dto.priority ?? 'NORMAL',
        status: 'TODO',
        periodKey: null,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        assigneeId: dto.assigneeId ?? null,
        branchId,
        createdById: userId,
      },
    });
  }

  private async getItemScoped(ctx: BranchContext, id: number) {
    const it = await this.db.taskItem.findUnique({ where: { id } });
    if (!it) throw new NotFoundException('Tugas tidak ditemukan.');
    if (!ctx.isOwner && it.branchId !== ctx.branchId)
      throw new ForbiddenException('Bukan cabang Anda.');
    return it;
  }

  async updateItem(
    ctx: BranchContext,
    id: number,
    dto: UpdateTaskItemDto,
    userId: number,
  ) {
    const it = await this.getItemScoped(ctx, id);
    const data: any = { ...dto };
    delete data.verified;
    if (dto.status && dto.status !== it.status) {
      if (dto.status === 'DONE') {
        data.completedAt = new Date();
        data.completedById = userId;
      } else {
        data.completedAt = null;
        data.completedById = null;
      }
    }
    if (dto.dueDate) data.dueDate = new Date(dto.dueDate);
    if (dto.verified !== undefined) {
      this.assertManager(ctx);
      data.verifiedByOwnerAt = dto.verified ? new Date() : null;
    }
    return this.db.taskItem.update({ where: { id }, data });
  }

  async moveItem(
    ctx: BranchContext,
    id: number,
    dto: MoveTaskItemDto,
    userId: number,
  ) {
    const it = await this.getItemScoped(ctx, id);
    const data: any = { status: dto.status, index: dto.index };
    if (dto.status === 'DONE' && it.status !== 'DONE') {
      data.completedAt = new Date();
      data.completedById = userId;
    }
    if (dto.status !== 'DONE') {
      data.completedAt = null;
      data.completedById = null;
    }
    return this.db.taskItem.update({ where: { id }, data });
  }

  async deleteItem(ctx: BranchContext, id: number) {
    this.assertManager(ctx);
    await this.getItemScoped(ctx, id);
    return this.db.taskItem.delete({ where: { id } });
  }

  // ---- STAT ringkas utk owner (siapa idle) ----
  async summary(ctx: BranchContext) {
    const where: any = {};
    if (!ctx.isOwner) where.branchId = ctx.branchId;
    else if (ctx.branchId != null) where.branchId = ctx.branchId;
    const items = await this.db.taskItem.findMany({
      where,
      include: { assignee: { select: { id: true, name: true } } },
    });
    const byUser: Record<string, any> = {};
    const now = new Date();
    for (const it of items) {
      const key = it.assigneeId ?? 'unassigned';
      const name = it.assignee?.name ?? 'Tanpa penanggung jawab';
      byUser[key] ??= {
        assigneeId: it.assigneeId,
        name,
        todo: 0,
        inProgress: 0,
        done: 0,
        overdue: 0,
      };
      if (it.status === 'TODO') byUser[key].todo++;
      else if (it.status === 'IN_PROGRESS') byUser[key].inProgress++;
      else if (it.status === 'DONE') byUser[key].done++;
      if (it.status !== 'DONE' && it.dueDate && new Date(it.dueDate) < now)
        byUser[key].overdue++;
    }
    return Object.values(byUser);
  }
}
