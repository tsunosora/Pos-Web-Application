import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { isOwnerRole } from '../common/branch-context.decorator';
import type { BranchContext } from '../common/branch-context.decorator';
import { TaskBoardService } from './task-board.service';
import { buildPiketPdfHtml, PDF_STAMP } from './piket-pdf.template';
import { renderPiketPdf, stampLabel } from './piket-pdf.render';
import {
  matchesOn,
  parseRotation,
  periodKeyFor,
  rotationAssigneeOn,
} from './recurrence.util';

/** Menit toleransi setelah jam batas tugas sebelum teguran otomatis dikirim. */
export const AUTO_WARN_GRACE_MIN = 15;

/** Menit sebelum jam batas saat pengingat (bukan teguran) mulai tampil ke karyawan. */
export const REMIND_BEFORE_MIN = 15;

export type CheckinShift = 'PAGI' | 'KEDUA' | 'LIBUR';

/** Satu slot tanda tangan PDF jadwal: label + orang ATAU jabatan (dua-duanya null = titik-titik). */
export interface PiketSignSlot {
  label: string;
  userId: number | null;
  roleId: number | null;
}

export function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "YYYY-MM-DD" → Date lokal awal hari; null bila format/tanggal tidak valid. */
export function parseDateKey(s?: string | null): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return periodKeyFor(d) === s ? d : null; // tolak mis. 2026-02-31
}

export function autoWarningMessage(title: string, due: Date): string {
  return `Tugas "${title}" belum ditandai Selesai padahal batasnya pukul ${hhmm(due)}. Segera kerjakan, lalu ubah statusnya menjadi Selesai di Papan Tugas.`;
}

export interface AutoWarnCandidate {
  id: number;
  title: string;
  status: string;
  dueDate: Date;
  createdAt: Date;
  assigneeId: number | null;
  branchId?: number | null;
  periodKey: string | null;
}

/**
 * Pilih kartu yang pantas ditegur otomatis (murni, tanpa DB).
 * - belum DONE, punya penerima & jam batas, belum pernah ditegur otomatis;
 * - penerima tidak memilih LIBUR pada hari kartu itu;
 * - sudah lewat batas + toleransi. Kartu yang baru dibuat SETELAH batas (mis.
 *   karyawan baru memilih shift saat datang) dihitung dari saat kartu dibuat.
 */
export function selectAutoWarnItems(
  items: AutoWarnCandidate[],
  now: Date,
  opts: {
    warnedItemIds: Set<number>;
    liburKeys: Set<string>;
    graceMin?: number;
    trialUntil?: string | null;
  },
): AutoWarnCandidate[] {
  const graceMs = (opts.graceMin ?? AUTO_WARN_GRACE_MIN) * 60000;
  return items.filter((it) => {
    if (it.status === 'DONE' || !it.assigneeId || !it.dueDate) return false;
    if (opts.warnedItemIds.has(it.id)) return false;
    const dayKey = it.periodKey ?? periodKeyFor(new Date(it.dueDate));
    if (opts.liburKeys.has(`${it.assigneeId}|${dayKey}`)) return false;
    if (isTrialDay(dayKey, opts.trialUntil)) return false; // masa uji coba: tanpa teguran
    const base = Math.max(
      new Date(it.dueDate).getTime(),
      new Date(it.createdAt).getTime(),
    );
    return now.getTime() - base >= graceMs;
  });
}

/** Tanggal "YYYY-MM-DD" termasuk masa uji coba piket? */
export function isTrialDay(
  dateKey: string,
  trialUntil?: string | null,
): boolean {
  return !!trialUntil && dateKey <= trialUntil;
}

/**
 * Piket & kepatuhan tugas: pilih shift harian, teguran (otomatis & manual)
 * yang hanya tampil ke karyawan bersangkutan, pemantauan harian & rekap bulanan.
 */
@Injectable()
export class TaskPiketService {
  private readonly logger = new Logger('TaskPiketService');
  constructor(
    private prisma: PrismaService,
    private board: TaskBoardService,
  ) {}
  private get db(): any {
    return this.prisma as any;
  }

  // ---- PDF JADWAL PIKET (dibuat otomatis dari jadwal; tanpa unggah manual) ----
  private pdfCache = new Map<string, { hash: string; pdf: Buffer }>();
  private pdfJobs = new Map<string, Promise<Buffer>>();

  /**
   * PDF jadwal piket sesuai data terbaru (tugas shift/grup, giliran, masa uji coba).
   * Dirender ulang hanya bila isi kertasnya berubah; selain itu diambil dari cache memori.
   */
  async piketPdf(branchId: number | null, now = new Date()): Promise<Buffer> {
    const [board, signatures] = await Promise.all([
      this.piketBoard(branchId, now),
      this.piketSignatures(),
    ]);
    const html = buildPiketPdfHtml({
      ...board,
      signatures,
      remindBeforeMin: REMIND_BEFORE_MIN,
      graceMin: AUTO_WARN_GRACE_MIN,
    });
    const hash = createHash('sha256').update(html).digest('hex');
    const key = String(branchId ?? 'all');
    const hit = this.pdfCache.get(key);
    if (hit?.hash === hash) return hit.pdf;
    const jobKey = `${key}:${hash}`;
    let job = this.pdfJobs.get(jobKey);
    if (!job) {
      job = renderPiketPdf(html.split(PDF_STAMP).join(stampLabel(now)))
        .then((pdf) => {
          this.pdfCache.set(key, { hash, pdf });
          return pdf;
        })
        .finally(() => this.pdfJobs.delete(jobKey));
      this.pdfJobs.set(jobKey, job);
    }
    return job;
  }

  /** PDF jadwal piket untuk pengguna PIN — cabang ikut data PIN karyawan. */
  async pinPiketPdf(
    designerId: number,
    pin: string,
    now = new Date(),
  ): Promise<Buffer> {
    await this.userForPin(designerId, pin);
    const d = await this.db.designer.findUnique({
      where: { id: designerId },
      select: { branchId: true },
    });
    return this.piketPdf(d?.branchId ?? null, now);
  }

  // ---- OWNER TIDAK IKUT TUGAS SHIFT ----
  private ownerCache: { at: number; ids: Set<number> } | null = null;

  /** Akun owner tidak diminta memilih shift & tidak menerima tugas shift. Cache 1 menit. */
  async ownerIds(): Promise<Set<number>> {
    if (this.ownerCache && Date.now() - this.ownerCache.at < 60_000)
      return this.ownerCache.ids;
    const users = await this.db.user.findMany({
      where: { isActive: true },
      select: { id: true, role: { select: { name: true } } },
    });
    const ids = new Set<number>(
      users.filter((u: any) => isOwnerRole(u.role?.name)).map((u: any) => u.id),
    );
    this.ownerCache = { at: Date.now(), ids };
    return ids;
  }

  // ---- MASA UJI COBA ----
  private trialCache: { at: number; value: string | null } | null = null;

  /** Tanggal akhir uji coba piket (tanpa teguran otomatis & tak dihitung rekap). Cache 1 menit. */
  async trialUntil(): Promise<string | null> {
    if (this.trialCache && Date.now() - this.trialCache.at < 60_000)
      return this.trialCache.value;
    const st = await this.db.storeSettings.findFirst({
      select: { piketTrialUntil: true },
    });
    const value = st?.piketTrialUntil ?? null;
    this.trialCache = { at: Date.now(), value };
    return value;
  }

  async setTrial(ctx: BranchContext, until: string | null) {
    this.assertManager(ctx);
    if (until != null && !parseDateKey(until))
      throw new BadRequestException('Format tanggal harus YYYY-MM-DD.');
    const st = await this.db.storeSettings.findFirst({ select: { id: true } });
    if (!st) throw new NotFoundException('Pengaturan toko belum ada.');
    await this.db.storeSettings.update({
      where: { id: st.id },
      data: { piketTrialUntil: until },
    });
    this.trialCache = null;
    return { trialUntil: until };
  }

  // ---- TANDA TANGAN PDF JADWAL (diatur owner/manajer di Pengaturan) ----
  private signCache: { at: number; value: PiketSignSlot[] } | null = null;

  /** Slot tanda tangan tersimpan (mentah, untuk form Pengaturan). Cache 1 menit. */
  async piketSignSlots(): Promise<PiketSignSlot[]> {
    if (this.signCache && Date.now() - this.signCache.at < 60_000)
      return this.signCache.value;
    const st = await this.db.storeSettings.findFirst({
      select: { piketSignatures: true },
    });
    let value: PiketSignSlot[] = [];
    try {
      const parsed: unknown = JSON.parse(st?.piketSignatures || '[]');
      if (Array.isArray(parsed))
        value = parsed.slice(0, 3).map((o: any) => ({
          label: String(o?.label ?? '').slice(0, 40) || 'Tanda tangan',
          userId: o?.userId ?? null,
          roleId: o?.roleId ?? null,
        }));
    } catch {
      value = [];
    }
    this.signCache = { at: Date.now(), value };
    return value;
  }

  /** Slot + nama siap cetak: orang → nama akun, jabatan → nama jabatan, kosong → null. */
  async piketSignatures(): Promise<{ label: string; name: string | null }[]> {
    const slots = await this.piketSignSlots();
    if (!slots.length) return [];
    const userIds = slots
      .map((x) => x.userId)
      .filter((x): x is number => x != null);
    const roleIds = slots
      .map((x) => x.roleId)
      .filter((x): x is number => x != null);
    const [users, roles] = await Promise.all([
      userIds.length
        ? this.db.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true },
          })
        : [],
      roleIds.length
        ? this.db.role.findMany({
            where: { id: { in: roleIds } },
            select: { id: true, name: true },
          })
        : [],
    ]);
    const nameOf = (x: PiketSignSlot): string | null => {
      if (x.userId != null)
        return users.find((u: any) => u.id === x.userId)?.name ?? null;
      if (x.roleId != null)
        return roles.find((r: any) => r.id === x.roleId)?.name ?? null;
      return null;
    };
    return slots.map((x) => ({ label: x.label, name: nameOf(x) }));
  }

  /** Owner/manajer mengatur tanda tangan: tiap slot label + orang ATAU jabatan. */
  async setPiketSignatures(ctx: BranchContext, raw: unknown[]) {
    this.assertManager(ctx);
    const list = Array.isArray(raw) ? raw : [];
    if (list.length > 3)
      throw new BadRequestException('Maksimal 3 tanda tangan.');
    const slots: PiketSignSlot[] = [];
    for (const r of list) {
      const o = (r ?? {}) as {
        label?: unknown;
        userId?: unknown;
        roleId?: unknown;
      };
      const label = String(o.label ?? '').trim();
      if (label.length > 40)
        throw new BadRequestException('Label tanda tangan maksimal 40 huruf.');
      const num = (v: unknown): number | null =>
        v == null || v === '' ? null : Number(v);
      const userId = num(o.userId);
      const roleId = num(o.roleId);
      if (userId != null && roleId != null)
        throw new BadRequestException(
          'Pilih orang atau jabatan, jangan keduanya.',
        );
      if (userId != null && !Number.isInteger(userId))
        throw new BadRequestException('Orang yang dipilih tidak valid.');
      if (roleId != null && !Number.isInteger(roleId))
        throw new BadRequestException('Jabatan yang dipilih tidak valid.');
      slots.push({ label: label || 'Tanda tangan', userId, roleId });
    }
    const userIds = [
      ...new Set(
        slots.map((x) => x.userId).filter((x): x is number => x != null),
      ),
    ];
    if (userIds.length) {
      const found = await this.db.user.findMany({
        where: { id: { in: userIds }, isActive: true },
        select: { id: true },
      });
      if (found.length !== userIds.length)
        throw new BadRequestException(
          'Orang yang dipilih tidak ditemukan atau nonaktif.',
        );
    }
    const roleIds = [
      ...new Set(
        slots.map((x) => x.roleId).filter((x): x is number => x != null),
      ),
    ];
    if (roleIds.length) {
      const found = await this.db.role.findMany({
        where: { id: { in: roleIds } },
        select: { id: true },
      });
      if (found.length !== roleIds.length)
        throw new BadRequestException('Jabatan yang dipilih tidak ditemukan.');
    }
    const st = await this.db.storeSettings.findFirst({ select: { id: true } });
    if (!st) throw new NotFoundException('Pengaturan toko belum ada.');
    await this.db.storeSettings.update({
      where: { id: st.id },
      data: { piketSignatures: slots.length ? JSON.stringify(slots) : null },
    });
    this.signCache = null;
    this.pdfCache.clear(); // kertas berubah → jangan sajikan PDF lama
    return { signatures: slots };
  }

  private assertManager(ctx: BranchContext) {
    if (!this.board.canAssign(ctx))
      throw new ForbiddenException(
        'Hanya owner/manajer yang boleh memantau & menegur.',
      );
  }

  /** Filter cabang: staf terkunci cabangnya; owner ikut cabang aktif (null = semua). */
  private branchWhere(ctx: BranchContext): { branchId?: number } {
    if (!ctx.isOwner) return { branchId: ctx.branchId as number };
    return ctx.branchId != null ? { branchId: ctx.branchId } : {};
  }

  /** Jadwal khusus-shift yang berlaku pada `date` beserta penerimanya. */
  private async shiftSchedulesOn(
    date: Date,
  ): Promise<{ sched: any; userIds: number[] }[]> {
    const rows = await this.db.taskSchedule.findMany({
      where: {
        isActive: true,
        shiftSlot: { not: null },
        frequency: { not: 'ONCE' },
      },
    });
    const out: { sched: any; userIds: number[] }[] = [];
    const owners = await this.ownerIds();
    for (const s of rows) {
      if (!s.shiftSlot || !matchesOn(s, date)) continue;
      const ids = (
        await this.board.resolveTargetUserIds(s, s.branchId, date)
      ).filter((x): x is number => x != null && !owners.has(x));
      out.push({ sched: s, userIds: ids });
    }
    return out;
  }

  // ---- PILIH SHIFT HARIAN (karyawan) ----
  async myDay(userId: number, now = new Date()) {
    const dateKey = periodKeyFor(now);
    const [checkin, scheds, trial] = await Promise.all([
      this.db.taskShiftCheckin.findUnique({
        where: { userId_dateKey: { userId, dateKey } },
      }),
      this.shiftSchedulesOn(now),
      this.trialUntil(),
    ]);
    const mine = scheds.filter((s) => s.userIds.includes(userId));
    const slots = [...new Set(mine.map((s) => String(s.sched.shiftSlot)))];
    // Judul tugas per shift → ditampilkan di tombol pilihan shift.
    const tasksBySlot: Record<string, string[]> = {};
    for (const s of mine)
      (tasksBySlot[s.sched.shiftSlot] ??= []).push(s.sched.title);
    return {
      dateKey,
      needsCheckin: mine.length > 0,
      slots,
      tasksBySlot,
      trialUntil: isTrialDay(dateKey, trial) ? trial : null,
      // Belum ada piket hari ini → kapan jadwal piket orang ini mulai (untuk info di halaman kerja).
      startsOn:
        mine.length === 0 ? await this.nextPiketStart(userId, now) : null,
      checkin: checkin
        ? { shift: checkin.shift as CheckinShift, at: checkin.updatedAt }
        : null,
    };
  }

  /** Tanggal mulai terdekat (di masa depan) dari jadwal aktif yang menarget user ini. */
  private async nextPiketStart(
    userId: number,
    now: Date,
  ): Promise<string | null> {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const rows = await this.db.taskSchedule.findMany({
      where: {
        isActive: true,
        frequency: { not: 'ONCE' },
        startDate: { gt: today },
      },
      orderBy: { startDate: 'asc' },
    });
    for (const s of rows) {
      if (!s.startDate || new Date(s.startDate) <= today) continue;
      const ids = s.rotationUserIds
        ? parseRotation(s.rotationUserIds)
        : (await this.board.resolveTargetUserIds(s, s.branchId, now)).filter(
            (x): x is number => x != null,
          );
      if (ids.includes(userId)) return periodKeyFor(new Date(s.startDate));
    }
    return null;
  }

  async checkin(userId: number, shift: CheckinShift, now = new Date()) {
    const dateKey = periodKeyFor(now);
    const mine = (await this.shiftSchedulesOn(now)).filter((s) =>
      s.userIds.includes(userId),
    );
    if (mine.length === 0)
      throw new BadRequestException(
        'Tidak ada jadwal piket shift untuk kamu hari ini.',
      );

    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: { branchId: true },
    });
    // User tanpa cabang (mis. owner yang ikut piket) → ikut cabang jadwal piketnya.
    const branchId = user?.branchId ?? mine[0].sched.branchId ?? null;
    await this.db.taskShiftCheckin.upsert({
      where: { userId_dateKey: { userId, dateKey } },
      create: { userId, dateKey, shift, branchId },
      update: { shift, branchId },
    });

    // Ganti pilihan (salah pilih / ternyata libur) → kartu shift LAIN hari ini
    // yang belum disentuh (TODO) dihapus. Yang sudah dikerjakan tetap.
    const otherShiftIds = (
      await this.db.taskSchedule.findMany({
        where: { shiftSlot: { not: null } },
        select: { id: true, shiftSlot: true },
      })
    )
      .filter((s: any) => s.shiftSlot !== shift)
      .map((s: any) => s.id);
    let removed = 0;
    if (otherShiftIds.length) {
      const r = await this.db.taskItem.deleteMany({
        where: {
          assigneeId: userId,
          periodKey: dateKey,
          status: 'TODO',
          scheduleId: { in: otherShiftIds },
        },
      });
      removed = r.count;
    }

    let created = 0;
    for (const { sched } of mine) {
      if (sched.shiftSlot === shift)
        created += await this.board.materializeSchedule(sched, now, userId);
    }
    return { dateKey, shift, created, removed };
  }

  // ---- AKSES LEWAT PIN (halaman /so-designer, /produksi, /cetak — tanpa login) ----
  /** Verifikasi PIN karyawan (tabel desainer/operator) → akun tugas yang terhubung. */
  async userForPin(
    designerId: number,
    pin: string,
  ): Promise<{ userId: number | null; name: string }> {
    const d = await this.db.designer.findUnique({
      where: { id: designerId },
      select: { id: true, name: true, pin: true, isActive: true, userId: true },
    });
    if (!d || !d.isActive || !pin || d.pin !== pin)
      throw new UnauthorizedException('PIN salah.');
    return { userId: d.userId ?? null, name: d.name };
  }

  /** Semua data pop-up piket untuk pengguna PIN dalam satu panggilan (dipoll tiap menit). */
  async pinState(designerId: number, pin: string, now = new Date()) {
    const { userId, name } = await this.userForPin(designerId, pin);
    if (!userId) return { linked: false as const, name };
    const [day, warnings, upcoming, today] = await Promise.all([
      this.myDay(userId, now),
      this.myWarnings(userId),
      this.myUpcoming(userId, now),
      this.myToday(userId, now),
    ]);
    return { linked: true as const, name, day, warnings, upcoming, today };
  }

  /** Checklist hari ini milik user — pengguna PIN tak bisa membuka Papan Tugas, jadi
   *  daftar ini ditampilkan & dicentang langsung dari halaman kerjanya. */
  async myToday(userId: number, now = new Date()) {
    const dateKey = periodKeyFor(now);
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayEnd = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
    );
    return this.db.taskItem.findMany({
      where: {
        assigneeId: userId,
        OR: [
          { periodKey: dateKey },
          { periodKey: null, dueDate: { gte: dayStart, lt: dayEnd } },
        ],
      },
      orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        dueDate: true,
        completedAt: true,
      },
      take: 50,
    });
  }

  /** Karyawan menandai tugasnya sendiri Selesai (dari kartu pengingat). */
  async completeOwnItem(userId: number, itemId: number) {
    const it = await this.db.taskItem.findUnique({
      where: { id: itemId },
      select: { id: true, assigneeId: true, status: true },
    });
    if (!it || it.assigneeId !== userId)
      throw new ForbiddenException(
        'Anda hanya bisa mengubah tugas Anda sendiri.',
      );
    if (it.status !== 'DONE') {
      await this.db.taskItem.update({
        where: { id: itemId },
        data: {
          status: 'DONE',
          completedAt: new Date(),
          completedById: userId,
        },
      });
    }
    return { id: it.id, status: 'DONE' };
  }

  // ---- PENGINGAT (bukan teguran, tidak dicatat) ----
  /** Tugas milik user yang jam batasnya dekat. Klien menampilkan pengingat mulai
   *  REMIND_BEFORE_MIN menit sebelum batas sampai teguran otomatis. Jendela
   *  dilebarkan (s/d 75 menit ke depan) agar polling 5 menit tidak terlewat. */
  async myUpcoming(userId: number, now = new Date()) {
    const items = await this.db.taskItem.findMany({
      where: {
        assigneeId: userId,
        status: { not: 'DONE' },
        dueDate: {
          gte: new Date(now.getTime() - AUTO_WARN_GRACE_MIN * 60000),
          lte: new Date(now.getTime() + 75 * 60000),
        },
      },
      orderBy: { dueDate: 'asc' },
      select: { id: true, title: true, status: true, dueDate: true },
      take: 20,
    });
    return {
      serverNow: now,
      remindBeforeMinutes: REMIND_BEFORE_MIN,
      graceMinutes: AUTO_WARN_GRACE_MIN,
      items,
    };
  }

  // ---- TEGURAN ----
  /** Teguran yang belum dibaca MILIK user ini saja (tak pernah milik orang lain). */
  async myWarnings(userId: number) {
    const rows = await this.db.taskWarning.findMany({
      where: { userId, acknowledgedAt: null },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });
    const itemIds = rows
      .map((r: any) => r.taskItemId)
      .filter((x: any) => x != null);
    const items = itemIds.length
      ? await this.db.taskItem.findMany({
          where: { id: { in: itemIds } },
          select: { id: true, title: true, status: true, dueDate: true },
        })
      : [];
    const byId = new Map(items.map((i: any) => [i.id, i]));
    return rows.map((r: any) => ({
      id: r.id,
      kind: r.kind,
      message: r.message,
      createdAt: r.createdAt,
      createdByName: r.createdByName,
      item: r.taskItemId != null ? (byId.get(r.taskItemId) ?? null) : null,
    }));
  }

  async ackWarnings(userId: number, ids?: number[]) {
    const where: any = { userId, acknowledgedAt: null };
    if (ids?.length) where.id = { in: ids };
    const r = await this.db.taskWarning.updateMany({
      where,
      data: { acknowledgedAt: new Date() },
    });
    return { acknowledged: r.count };
  }

  async createWarning(
    ctx: BranchContext,
    dto: { userId: number; message: string },
    byUserId: number,
  ) {
    this.assertManager(ctx);
    const target = await this.db.user.findUnique({
      where: { id: dto.userId },
      select: { id: true, branchId: true, isActive: true },
    });
    if (!target || !target.isActive)
      throw new NotFoundException('Karyawan tidak ditemukan.');
    if (!ctx.isOwner && target.branchId !== ctx.branchId)
      throw new ForbiddenException('Bukan cabang Anda.');
    const by = await this.db.user.findUnique({
      where: { id: byUserId },
      select: { name: true },
    });
    return this.db.taskWarning.create({
      data: {
        userId: target.id,
        branchId: target.branchId ?? ctx.branchId ?? null, // user tanpa cabang → cabang yang dipantau
        dateKey: periodKeyFor(new Date()),
        kind: 'MANUAL',
        message: dto.message.trim(),
        createdById: byUserId,
        createdByName: by?.name ?? null,
      },
    });
  }

  /** Dipanggil cron tiap 5 menit. Idempoten: 1 teguran otomatis per kartu. */
  async sendAutoWarnings(now = new Date()) {
    const since = new Date(now.getTime() - 24 * 3600000);
    const cutoff = new Date(now.getTime() - AUTO_WARN_GRACE_MIN * 60000);
    const items: AutoWarnCandidate[] = await this.db.taskItem.findMany({
      where: {
        status: { not: 'DONE' },
        assigneeId: { not: null },
        dueDate: { gte: since, lte: cutoff },
      },
      select: {
        id: true,
        title: true,
        status: true,
        dueDate: true,
        createdAt: true,
        assigneeId: true,
        branchId: true,
        periodKey: true,
      },
    });
    if (!items.length) return { created: 0 };
    const ids = items.map((i) => i.id);
    const userIds = [...new Set(items.map((i) => i.assigneeId as number))];
    const keys = [
      ...new Set(
        items.map((i) => i.periodKey ?? periodKeyFor(new Date(i.dueDate))),
      ),
    ];
    const [warned, libur] = await Promise.all([
      this.db.taskWarning.findMany({
        where: { kind: 'AUTO', taskItemId: { in: ids } },
        select: { taskItemId: true },
      }),
      this.db.taskShiftCheckin.findMany({
        where: {
          shift: 'LIBUR',
          userId: { in: userIds },
          dateKey: { in: keys },
        },
        select: { userId: true, dateKey: true },
      }),
    ]);
    const trial = await this.trialUntil();
    const picks = selectAutoWarnItems(items, now, {
      trialUntil: trial,
      warnedItemIds: new Set(warned.map((w: any) => w.taskItemId)),
      liburKeys: new Set(libur.map((l: any) => `${l.userId}|${l.dateKey}`)),
    });
    let created = 0;
    for (const it of picks) {
      try {
        await this.db.taskWarning.create({
          data: {
            userId: it.assigneeId,
            branchId: it.branchId ?? null,
            dateKey: it.periodKey ?? periodKeyFor(new Date(it.dueDate)),
            kind: 'AUTO',
            taskItemId: it.id,
            message: autoWarningMessage(it.title, new Date(it.dueDate)),
          },
        });
        created++;
      } catch (e: any) {
        if (e?.code !== 'P2002') throw e; // sudah ditegur (idempoten)
      }
    }
    if (created)
      this.logger.log(`Teguran otomatis: ${created} tugas lewat batas.`);
    return { created };
  }

  // ---- PEMANTAUAN (owner/manajer) ----
  async monitor(ctx: BranchContext, dateStr?: string, now = new Date()) {
    this.assertManager(ctx);
    if (dateStr && !parseDateKey(dateStr))
      throw new BadRequestException('Format tanggal harus YYYY-MM-DD.');
    const date =
      parseDateKey(dateStr) ??
      new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dateKey = periodKeyFor(date);
    const dayStart = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
    );
    const dayEnd = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate() + 1,
    );
    const bw = this.branchWhere(ctx);

    const [items, checkins, warnings, shiftScheds] = await Promise.all([
      this.db.taskItem.findMany({
        where: {
          ...bw,
          assigneeId: { not: null },
          OR: [
            { periodKey: dateKey },
            { periodKey: null, dueDate: { gte: dayStart, lt: dayEnd } },
          ],
        },
        orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
      }),
      this.db.taskShiftCheckin.findMany({ where: { ...bw, dateKey } }),
      this.db.taskWarning.findMany({
        where: { ...bw, dateKey },
        orderBy: { createdAt: 'asc' },
      }),
      this.shiftSchedulesOn(date),
    ]);

    // Peserta yang wajib memilih shift. Jadwal cabang lain diabaikan; jadwal global
    // (tanpa cabang) hanya menghitung karyawan dari cabang yang dipantau.
    const expected = new Map<number, Set<string>>();
    const globalOnly = new Set<number>();
    for (const s of shiftScheds) {
      const sb = s.sched.branchId;
      if (bw.branchId != null && sb != null && sb !== bw.branchId) continue;
      for (const u of s.userIds) {
        if (!expected.has(u)) {
          expected.set(u, new Set());
          if (sb == null) globalOnly.add(u);
        } else if (sb != null) globalOnly.delete(u);
        expected.get(u)!.add(String(s.sched.shiftSlot));
      }
    }
    const active = new Set<number>([
      ...items.map((i: any) => i.assigneeId),
      ...checkins.map((c: any) => c.userId),
      ...warnings.map((w: any) => w.userId),
    ]);
    const users = await this.db.user.findMany({
      where: { id: { in: [...new Set([...active, ...expected.keys()])] } },
      select: { id: true, name: true, branchId: true },
    });
    const warnedItemIds = new Set<number>(
      warnings
        .filter((w: any) => w.kind === 'AUTO' && w.taskItemId != null)
        .map((w: any) => w.taskItemId),
    );

    const rows = users
      // Peserta yang hanya "diharapkan" (belum punya data) harus dari cabang yang dipantau.
      .filter(
        (u: any) =>
          active.has(u.id) ||
          bw.branchId == null ||
          !globalOnly.has(u.id) ||
          u.branchId === bw.branchId,
      )
      .map((u: any) => {
        const its = items
          .filter((i: any) => i.assigneeId === u.id)
          .map((i: any) => {
            const due = i.dueDate ? new Date(i.dueDate) : null;
            const done = i.status === 'DONE';
            return {
              id: i.id,
              title: i.title,
              status: i.status,
              dueDate: i.dueDate,
              completedAt: i.completedAt,
              verifiedByOwnerAt: i.verifiedByOwnerAt,
              note: i.note,
              late:
                done &&
                !!due &&
                !!i.completedAt &&
                new Date(i.completedAt) > due,
              overdue: !done && !!due && due < now,
              warned: warnedItemIds.has(i.id),
            };
          });
        const c = checkins.find((x: any) => x.userId === u.id);
        return {
          userId: u.id,
          name: u.name,
          shiftSlots: [...(expected.get(u.id) ?? [])],
          checkin: c ? { shift: c.shift, at: c.updatedAt } : null,
          counts: {
            total: its.length,
            done: its.filter((i: any) => i.status === 'DONE').length,
            doneLate: its.filter((i: any) => i.late).length,
            open: its.filter((i: any) => i.status !== 'DONE').length,
            overdue: its.filter((i: any) => i.overdue).length,
          },
          items: its,
          warnings: warnings
            .filter((w: any) => w.userId === u.id)
            .map((w: any) => ({
              id: w.id,
              kind: w.kind,
              message: w.message,
              taskItemId: w.taskItemId,
              createdAt: w.createdAt,
              acknowledgedAt: w.acknowledgedAt,
              createdByName: w.createdByName,
            })),
        };
      })
      .sort(
        (a: any, b: any) =>
          b.counts.overdue - a.counts.overdue ||
          Number(!!a.checkin) - Number(!!b.checkin) ||
          String(a.name ?? '').localeCompare(String(b.name ?? '')),
      );

    const trial = await this.trialUntil();
    // Tanggal yang akan datang: kartu belum dibuat → tampilkan rencana dari jadwal.
    const plan =
      dateKey > periodKeyFor(now)
        ? await this.planFor(bw.branchId ?? null, date, false)
        : null;
    return {
      dateKey,
      graceMinutes: AUTO_WARN_GRACE_MIN,
      trialUntil: trial,
      trial: isTrialDay(dateKey, trial),
      plan,
      rows,
    };
  }

  async recap(ctx: BranchContext, monthStr?: string, now = new Date()) {
    this.assertManager(ctx);
    let y = now.getFullYear();
    let m = now.getMonth() + 1;
    if (monthStr) {
      const mm = /^(\d{4})-(\d{2})$/.exec(monthStr);
      if (!mm || Number(mm[2]) < 1 || Number(mm[2]) > 12)
        throw new BadRequestException('Format bulan harus YYYY-MM.');
      y = Number(mm[1]);
      m = Number(mm[2]);
    }
    const month = `${y}-${String(m).padStart(2, '0')}`;
    const prefix = `${month}-`;
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 1);
    const bw = this.branchWhere(ctx);

    const [items, checkins, warnings] = await Promise.all([
      this.db.taskItem.findMany({
        where: {
          ...bw,
          assigneeId: { not: null },
          OR: [
            { periodKey: { startsWith: prefix } },
            { periodKey: null, dueDate: { gte: start, lt: end } },
          ],
        },
        select: {
          assigneeId: true,
          status: true,
          dueDate: true,
          completedAt: true,
          periodKey: true,
        },
      }),
      this.db.taskShiftCheckin.findMany({
        where: { ...bw, dateKey: { startsWith: prefix } },
        select: { userId: true, shift: true, dateKey: true },
      }),
      this.db.taskWarning.findMany({
        where: { ...bw, dateKey: { startsWith: prefix } },
        select: {
          userId: true,
          kind: true,
          acknowledgedAt: true,
          dateKey: true,
        },
      }),
    ]);

    const acc = new Map<number, any>();
    const row = (id: number) => {
      if (!acc.has(id))
        acc.set(id, {
          userId: id,
          total: 0,
          doneOnTime: 0,
          doneLate: 0,
          missed: 0,
          pending: 0,
          workDays: 0,
          liburDays: 0,
          warnAuto: 0,
          warnManual: 0,
          warnUnread: 0,
        });
      return acc.get(id);
    };
    // Hari-hari masa uji coba tidak dihitung.
    const trial = await this.trialUntil();
    const inTrial = (k?: string | null) => !!k && isTrialDay(k, trial);
    for (const i of items) {
      if (
        inTrial(
          i.periodKey ?? (i.dueDate ? periodKeyFor(new Date(i.dueDate)) : null),
        )
      )
        continue;
      const r = row(i.assigneeId);
      r.total++;
      const due = i.dueDate ? new Date(i.dueDate) : null;
      if (i.status === 'DONE') {
        if (due && i.completedAt && new Date(i.completedAt) > due) r.doneLate++;
        else r.doneOnTime++;
      } else if (due && due < now) r.missed++;
      else r.pending++;
    }
    for (const c of checkins) {
      if (inTrial(c.dateKey)) continue;
      const r = row(c.userId);
      if (c.shift === 'LIBUR') r.liburDays++;
      else r.workDays++;
    }
    for (const w of warnings) {
      if (inTrial(w.dateKey)) continue;
      const r = row(w.userId);
      if (w.kind === 'AUTO') r.warnAuto++;
      else r.warnManual++;
      if (!w.acknowledgedAt) r.warnUnread++;
    }
    const users = await this.db.user.findMany({
      where: { id: { in: [...acc.keys()] } },
      select: { id: true, name: true },
    });
    const names = new Map(users.map((u: any) => [u.id, u.name]));
    const rows = [...acc.values()]
      .map((r) => {
        const judged = r.doneOnTime + r.doneLate + r.missed;
        return {
          ...r,
          name: names.get(r.userId) ?? `#${r.userId}`,
          compliancePct: judged
            ? Math.round((r.doneOnTime / judged) * 100)
            : null,
        };
      })
      .sort(
        (a, b) =>
          (a.compliancePct ?? 101) - (b.compliancePct ?? 101) ||
          String(a.name).localeCompare(String(b.name)),
      );
    return {
      month,
      rows,
      trialUntil: trial && trial >= `${month}-01` ? trial : null,
    };
  }

  // ---- RENCANA (tanggal yang akan datang; kartu belum dibuat) ----
  /** Siapa dapat tugas apa pada `date` menurut jadwal aktif. Tugas shift = pilihan per slot. */
  async planFor(branchId: number | null, date: Date, piketOnly: boolean) {
    const dateKey = periodKeyFor(date);
    const trial = await this.trialUntil();
    const schedules: any[] = (
      await this.db.taskSchedule.findMany({
        where: {
          isActive: true,
          frequency: { not: 'ONCE' },
          ...(branchId != null
            ? { OR: [{ branchId }, { branchId: null }] }
            : {}),
        },
        include: { group: { select: { name: true } } },
        orderBy: [{ timeOfDay: 'asc' }, { id: 'asc' }],
      })
    ).filter(
      (s: any) => (!piketOnly || this.isPiketSchedule(s)) && matchesOn(s, date),
    );

    const shiftOptions: Record<
      string,
      { title: string; timeOfDay: string | null }[]
    > = {};
    const shiftUsers = new Set<number>();
    const owners = await this.ownerIds();
    const perUser = new Map<
      number,
      { title: string; timeOfDay: string | null; rotation: boolean }[]
    >();
    for (const s of schedules) {
      if (s.shiftSlot) {
        (shiftOptions[s.shiftSlot] ??= []).push({
          title: s.title,
          timeOfDay: s.timeOfDay,
        });
        for (const u of await this.board.resolveTargetUserIds(
          s,
          s.branchId,
          date,
        ))
          if (u != null && !owners.has(u)) shiftUsers.add(u);
        continue;
      }
      const ids = s.rotationUserIds
        ? [rotationAssigneeOn(s, date)]
        : await this.board.resolveTargetUserIds(s, s.branchId, date);
      for (const u of ids) {
        if (u == null) continue;
        if (!perUser.has(u)) perUser.set(u, []);
        perUser
          .get(u)!
          .push({
            title: s.title,
            timeOfDay: s.timeOfDay,
            rotation: !!s.rotationUserIds,
          });
      }
    }
    const ids = [...new Set([...perUser.keys(), ...shiftUsers])];
    const users = ids.length
      ? await this.db.user.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true },
        })
      : [];
    const rows = ids
      .map((id) => ({
        userId: id,
        name: users.find((u: any) => u.id === id)?.name ?? `#${id}`,
        needsShift: shiftUsers.has(id),
        tasks: (perUser.get(id) ?? []).sort((a, b) =>
          String(a.timeOfDay ?? '99').localeCompare(
            String(b.timeOfDay ?? '99'),
          ),
        ),
      }))
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
    return {
      dateKey,
      trialUntil: isTrialDay(dateKey, trial) ? trial : null,
      shiftOptions,
      rows,
    };
  }

  // ---- PAPAN PIKET (dilihat semua karyawan; tanpa teguran/catatan pribadi) ----
  /** Jadwal yang dianggap piket: khusus shift, giliran, atau target grup bernama "piket". */
  private isPiketSchedule(s: any): boolean {
    return !!(
      s.shiftSlot ||
      s.rotationUserIds ||
      /piket/i.test(s.group?.name ?? '')
    );
  }

  async piketBoard(branchId: number | null, now = new Date()) {
    const dateKey = periodKeyFor(now);
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayEnd = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
    );
    const trial = await this.trialUntil();

    const schedules: any[] = (
      await this.db.taskSchedule.findMany({
        where: {
          isActive: true,
          frequency: { not: 'ONCE' },
          ...(branchId != null
            ? { OR: [{ branchId }, { branchId: null }] }
            : {}),
        },
        include: { group: { select: { name: true } } },
        orderBy: [{ timeOfDay: 'asc' }, { id: 'asc' }],
      })
    ).filter((s: any) => this.isPiketSchedule(s));

    const targets = new Map<number, number[]>();
    const owners = await this.ownerIds();
    for (const s of schedules) {
      const ids = s.rotationUserIds
        ? parseRotation(s.rotationUserIds)
        : (await this.board.resolveTargetUserIds(s, s.branchId, now)).filter(
            (x): x is number => x != null && !(s.shiftSlot && owners.has(x)),
          );
      targets.set(s.id, ids);
    }
    const piketIds = new Set(schedules.map((s) => s.id));
    const [checkins, rawItems] = await Promise.all([
      this.db.taskShiftCheckin.findMany({
        where: { dateKey, ...(branchId != null ? { branchId } : {}) },
      }),
      this.db.taskItem.findMany({
        where: {
          assigneeId: { not: null },
          ...(branchId != null ? { branchId } : {}),
          OR: [
            { periodKey: dateKey },
            { periodKey: null, dueDate: { gte: dayStart, lt: dayEnd } },
          ],
        },
        orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          title: true,
          status: true,
          dueDate: true,
          completedAt: true,
          assigneeId: true,
          scheduleId: true,
        },
      }),
    ]);
    // Hanya kartu dari jadwal piket — tugas pribadi di Papan Tugas tetap privat.
    const items = rawItems.filter((i: any) => piketIds.has(i.scheduleId));

    const allIds = new Set<number>();
    for (const v of targets.values()) v.forEach((x) => allIds.add(x));
    items.forEach((i: any) => allIds.add(i.assigneeId));
    const users = await this.db.user.findMany({
      where: { id: { in: [...allIds] } },
      select: { id: true, name: true },
    });
    const nameOf = (id: number) =>
      users.find((u: any) => u.id === id)?.name ?? `#${id}`;
    const uniq = (xs: number[]) => [...new Set(xs)];
    const view = (s: any) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      timeOfDay: s.timeOfDay,
      frequency: s.frequency,
      daysOfWeek: s.daysOfWeek,
      startDate: s.startDate,
      groupName: s.group?.name ?? null,
    });

    const shiftScheds = schedules.filter((s) => s.shiftSlot);
    const rotationScheds = schedules.filter((s) => s.rotationUserIds);
    const groupScheds = schedules.filter(
      (s) => !s.shiftSlot && !s.rotationUserIds,
    );

    // Giliran 4 pekan (Senin pekan ini) dari jadwal giliran harian.
    let rotation: any = null;
    const primary =
      rotationScheds.find((s) => s.frequency === 'DAILY') ?? rotationScheds[0];
    if (primary) {
      const iso = dayStart.getDay() === 0 ? 7 : dayStart.getDay();
      const monday = new Date(
        dayStart.getFullYear(),
        dayStart.getMonth(),
        dayStart.getDate() - (iso - 1),
      );
      const weeks = [];
      for (let w = 0; w < 4; w++) {
        const days = [];
        for (let d = 0; d < 7; d++) {
          const date = new Date(
            monday.getFullYear(),
            monday.getMonth(),
            monday.getDate() + w * 7 + d,
          );
          const uid = rotationAssigneeOn(primary, date);
          const key = periodKeyFor(date);
          days.push({
            date: key,
            iso: d + 1,
            name: uid ? nameOf(uid) : null,
            isToday: key === dateKey,
            active: matchesOn(primary, date),
          });
        }
        weeks.push({ start: days[0].date, days });
      }
      rotation = {
        order: parseRotation(primary.rotationUserIds).map(nameOf),
        weeks,
      };
    }

    // Status hari ini per orang.
    const todayScheds = schedules.filter((s) => matchesOn(s, now));
    const shiftUsers = new Set(
      todayScheds
        .filter((s) => s.shiftSlot)
        .flatMap((s) => targets.get(s.id) ?? []),
    );
    const people = new Set<number>();
    for (const s of todayScheds) {
      if (s.rotationUserIds) {
        const u = rotationAssigneeOn(s, now);
        if (u) people.add(u);
      } else (targets.get(s.id) ?? []).forEach((u) => people.add(u));
    }
    items.forEach((i: any) => people.add(i.assigneeId));
    const rank = (p: any) =>
      p.shift === 'PAGI'
        ? 0
        : p.shift === 'KEDUA'
          ? 1
          : p.needsShift && !p.shift
            ? 2
            : p.shift === 'LIBUR'
              ? 4
              : 3;
    const today = [...people]
      .map((uid) => {
        const c = checkins.find((x: any) => x.userId === uid);
        return {
          userId: uid,
          name: nameOf(uid),
          needsShift: shiftUsers.has(uid),
          shift: c?.shift ?? null,
          tasks: items
            .filter((i: any) => i.assigneeId === uid)
            .map((i: any) => ({
              id: i.id,
              title: i.title,
              status: i.status,
              dueDate: i.dueDate,
              completedAt: i.completedAt,
            })),
        };
      })
      .sort(
        (a, b) =>
          rank(a) - rank(b) || String(a.name).localeCompare(String(b.name)),
      );

    // Rencana 7 hari ke depan supaya karyawan tahu gilirannya lebih awal.
    const upcoming = [];
    for (let i = 1; i <= 7; i++) {
      upcoming.push(
        await this.planFor(
          branchId,
          new Date(
            dayStart.getFullYear(),
            dayStart.getMonth(),
            dayStart.getDate() + i,
          ),
          true,
        ),
      );
    }

    return {
      dateKey,
      trialUntil: isTrialDay(dateKey, trial) ? trial : null,
      shiftTasks: shiftScheds.map((s) => ({ ...view(s), slot: s.shiftSlot })),
      shiftMembers: uniq(
        shiftScheds.flatMap((s) => targets.get(s.id) ?? []),
      ).map(nameOf),
      groupTasks: groupScheds.map((s) => ({
        ...view(s),
        members: (targets.get(s.id) ?? []).map(nameOf),
      })),
      rotationTasks: rotationScheds.map(view),
      rotation,
      today,
      upcoming,
      jadwalPdf: { auto: true as const }, // PDF jadwal dibuat otomatis dari data papan ini
    };
  }

  /** Papan piket untuk pengguna PIN — cabang ikut data PIN karyawan. */
  async pinBoard(designerId: number, pin: string, now = new Date()) {
    await this.userForPin(designerId, pin);
    const d = await this.db.designer.findUnique({
      where: { id: designerId },
      select: { branchId: true },
    });
    return this.piketBoard(d?.branchId ?? null, now);
  }
}
