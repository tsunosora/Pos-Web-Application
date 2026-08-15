import {
  BadRequestException,
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

  /** Boleh memberi/mengelola tugas? Hanya Owner + Manajer (Admin TIDAK boleh). */
  canAssign(ctx: BranchContext): boolean {
    const r = String(ctx.roleName ?? '').toUpperCase();
    return (
      ctx.isOwner ||
      r.includes('MANAJER') ||
      r.includes('MANAGER') ||
      r.includes('SUPERVISOR') ||
      r.includes('KEPALA')
    );
  }

  private assertManager(ctx: BranchContext) {
    if (!this.canAssign(ctx))
      throw new ForbiddenException(
        'Hanya owner/manajer yang boleh memberi & mengelola tugas.',
      );
  }

  /** Resolusi daftar penerima dari sebuah target (assignee/grup/role/semua).
   *  Mengembalikan array userId (personal). [null] = kartu cabang tanpa penerima. */
  private async resolveTargetUserIds(
    t: { assigneeId?: number | null; groupId?: number | null; targetRole?: string | null; targetAll?: boolean | null },
    branchId: number | null,
  ): Promise<(number | null)[]> {
    if (t.assigneeId) return [t.assigneeId];
    if (t.groupId) {
      const members = await this.db.taskGroupMember.findMany({
        where: { groupId: t.groupId, user: { isActive: true } },
        select: { userId: true },
      });
      return members.map((m: any) => m.userId);
    }
    if (t.targetRole) {
      const users = await this.db.user.findMany({
        where: {
          isActive: true,
          role: { name: { equals: t.targetRole } },
          ...(branchId != null ? { branchId } : {}),
        },
        select: { id: true },
      });
      return users.map((u: any) => u.id);
    }
    if (t.targetAll) {
      const users = await this.db.user.findMany({
        where: { isActive: true, ...(branchId != null ? { branchId } : {}) },
        select: { id: true },
      });
      return users.map((u: any) => u.id);
    }
    return [null];
  }

  // ---- SCHEDULE (aturan berulang) ----
  listSchedules(ctx: BranchContext) {
    const where: any = {};
    if (!ctx.isOwner) where.branchId = ctx.branchId;
    else if (ctx.branchId != null) where.branchId = ctx.branchId;
    return this.db.taskSchedule.findMany({
      where,
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
      include: {
        assignee: { select: { id: true, name: true } },
        group: { select: { id: true, name: true } },
      },
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
        groupId: dto.groupId ?? null,
        targetRole: dto.targetRole ?? null,
        targetAll: dto.targetAll ?? false,
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
  private async materializeSchedule(sched: any, date: Date): Promise<number> {
    const periodKey = periodKeyFor(date);
    const assignees = await this.resolveTargetUserIds(sched, sched.branchId);
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
  async listItems(
    ctx: BranchContext,
    opts: { assigneeId?: number; mine?: boolean; userId?: number },
  ) {
    const where: any = {};
    const canAssign = this.canAssign(ctx);
    if (!canAssign || (opts.mine && opts.userId)) {
      // Non-manajer (atau mode "Tugas Saya"): HANYA tugas miliknya — privat,
      // tugas personal karyawan lain tidak terlihat. Apa pun cabangnya.
      if (!opts.userId) return [];
      where.assigneeId = opts.userId;
    } else {
      // Owner/Manajer lihat semua di cabang aktif.
      if (!ctx.isOwner) where.branchId = ctx.branchId;
      else if (ctx.branchId != null) where.branchId = ctx.branchId;
      if (opts.assigneeId) where.assigneeId = opts.assigneeId;
    }
    const rows = await this.db.taskItem.findMany({
      where,
      orderBy: [{ status: 'asc' }, { index: 'asc' }, { dueDate: 'asc' }],
      include: { assignee: { select: { id: true, name: true } } },
    });
    return rows.map((r: any) => ({ ...r, imageUrls: this.parseImages(r.imageUrls) }));
  }

  async createItem(ctx: BranchContext, dto: CreateTaskItemDto, userId: number) {
    this.assertManager(ctx);
    const fallback = ctx.isOwner
      ? (dto.branchId ?? ctx.branchId ?? null)
      : ctx.branchId;
    // Ekspansi target → 1 kartu PERSONAL per orang (grup/divisi/semua).
    const targets = await this.resolveTargetUserIds(dto, fallback);
    // Bila target berupa grup/divisi/semua tapi tak ada karyawan aktif, jangan
    // diam-diam membuat 0 kartu — beri tahu pemberi tugas.
    const isBroadcast = !!(dto.groupId || dto.targetRole || dto.targetAll);
    if (isBroadcast && targets.filter((t) => t != null).length === 0) {
      throw new BadRequestException(
        'Tidak ada karyawan aktif pada target ini. Tambah anggota grup atau pilih penerima lain.',
      );
    }
    const imageUrls =
      dto.imageUrls && dto.imageUrls.length
        ? JSON.stringify(dto.imageUrls)
        : null;
    const items: any[] = [];
    for (const assigneeId of targets) {
      const branchId = await this.branchForAssignee(assigneeId, fallback);
      items.push(
        await this.db.taskItem.create({
          data: {
            scheduleId: null,
            title: dto.title,
            description: dto.description ?? null,
            priority: dto.priority ?? 'NORMAL',
            status: 'TODO',
            periodKey: null,
            dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
            imageUrls,
            assigneeId,
            branchId,
            createdById: userId,
          },
        }),
      );
    }
    return { created: items.length, items };
  }

  /** Parse kolom imageUrls (JSON string) → array URL untuk response. */
  private parseImages(raw: any): string[] {
    if (!raw) return [];
    try {
      const v = JSON.parse(raw);
      return Array.isArray(v) ? v.filter((s) => typeof s === 'string') : [];
    } catch {
      return [];
    }
  }

  private async getItemScoped(
    ctx: BranchContext,
    id: number,
    userId?: number,
  ) {
    const it = await this.db.taskItem.findUnique({ where: { id } });
    if (!it) throw new NotFoundException('Tugas tidak ditemukan.');
    if (ctx.isOwner) return it;
    if (this.canAssign(ctx)) {
      if (it.branchId !== ctx.branchId)
        throw new ForbiddenException('Bukan cabang Anda.');
      return it;
    }
    // Karyawan biasa hanya boleh menyentuh tugasnya sendiri.
    if (userId != null && it.assigneeId === userId) return it;
    throw new ForbiddenException('Anda hanya bisa mengubah tugas Anda sendiri.');
  }

  async updateItem(
    ctx: BranchContext,
    id: number,
    dto: UpdateTaskItemDto,
    userId: number,
  ) {
    const it = await this.getItemScoped(ctx, id, userId);
    const data: any = { ...dto };
    delete data.verified;
    if (dto.imageUrls !== undefined) {
      // Hanya pemberi tugas (owner/manajer) boleh mengubah lampiran brief.
      this.assertManager(ctx);
      data.imageUrls = dto.imageUrls?.length
        ? JSON.stringify(dto.imageUrls)
        : null;
    }
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
    const it = await this.getItemScoped(ctx, id, userId);
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

  // ---- GRUP TIM KUSTOM ----
  listGroups(ctx: BranchContext) {
    const where: any = {};
    if (!ctx.isOwner) where.branchId = ctx.branchId;
    else if (ctx.branchId != null) where.branchId = ctx.branchId;
    return this.db.taskGroup.findMany({
      where,
      orderBy: { name: 'asc' },
      include: { members: { include: { user: { select: { id: true, name: true } } } } },
    });
  }

  async createGroup(
    ctx: BranchContext,
    dto: { name: string; memberIds?: number[]; branchId?: number },
    userId: number,
  ) {
    this.assertManager(ctx);
    const branchId = ctx.isOwner
      ? (dto.branchId ?? ctx.branchId ?? null)
      : ctx.branchId;
    return this.db.taskGroup.create({
      data: {
        name: dto.name,
        branchId,
        createdById: userId,
        members: {
          create: (dto.memberIds ?? []).map((uid) => ({ userId: uid })),
        },
      },
      include: { members: true },
    });
  }

  private async getGroupScoped(ctx: BranchContext, id: number) {
    const g = await this.db.taskGroup.findUnique({ where: { id } });
    if (!g) throw new NotFoundException('Grup tidak ditemukan.');
    if (!ctx.isOwner && g.branchId !== ctx.branchId)
      throw new ForbiddenException('Bukan cabang Anda.');
    return g;
  }

  async updateGroup(
    ctx: BranchContext,
    id: number,
    dto: { name?: string; memberIds?: number[] },
  ) {
    this.assertManager(ctx);
    await this.getGroupScoped(ctx, id);
    if (dto.memberIds) {
      // Ganti total anggota.
      await this.db.taskGroupMember.deleteMany({ where: { groupId: id } });
      await this.db.taskGroupMember.createMany({
        data: dto.memberIds.map((uid) => ({ groupId: id, userId: uid })),
        skipDuplicates: true,
      });
    }
    return this.db.taskGroup.update({
      where: { id },
      data: { ...(dto.name != null ? { name: dto.name } : {}) },
      include: { members: { include: { user: { select: { id: true, name: true } } } } },
    });
  }

  async deleteGroup(ctx: BranchContext, id: number) {
    this.assertManager(ctx);
    await this.getGroupScoped(ctx, id);
    return this.db.taskGroup.delete({ where: { id } }); // cascade hapus member
  }
}
