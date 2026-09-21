import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionsService } from '../transactions/transactions.service';
import { StockPurchasesService } from '../stock-purchases/stock-purchases.service';
import { StockTransfersService } from '../stock-transfers/stock-transfers.service';
import { StockOpnameService } from '../stock-opname/stock-opname.service';
import type { BranchContext } from '../common/branch-context.decorator';
import { requireBranch } from '../common/branch-where.helper';
import {
  ENTITY_REGISTRY,
  PULLABLE_ENTITIES,
  WEB_PULLABLE_ENTITIES,
  type PullableEntity,
  type PullResult,
  type PushOp,
  type PushOpResult,
  type PushResult,
} from './dto';

/** Siapa pemanggil sync: perangkat ber-token (x-device-token) atau user JWT. */
export interface SyncCaller {
  isDevice: boolean;
  userId: number | null; // user JWT; null untuk perangkat
}

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly transactions: TransactionsService,
    private readonly stockPurchases: StockPurchasesService,
    private readonly stockTransfers: StockTransfersService,
    private readonly stockOpname: StockOpnameService,
  ) {}

  /**
   * PULL: kembalikan baris referensi yang berubah sejak `since` (ISO).
   * - `since` kosong → snapshot penuh (full=true) → klien mengganti mirror lokal.
   * - Referensi bersifat server-authoritative & pull-only → tak ada konflik.
   * - Penghapusan permanen tak dilacak (app pakai isActive, bukan deletedAt); klien
   *   merekonsiliasi hapus lewat pull penuh berkala. Arsip (isActive=false) tetap
   *   terkirim sebagai perubahan biasa.
   */
  async pull(
    branchCtx: BranchContext,
    since?: string,
    entitiesCsv?: string,
    caller: SyncCaller = { isDevice: false, userId: null },
  ): Promise<PullResult> {
    const serverTime = new Date().toISOString();
    const full = !since;
    const sinceDate = since ? new Date(since) : null;
    if (sinceDate && Number.isNaN(sinceDate.getTime())) {
      // Cursor tak valid → perlakukan sebagai pull penuh (aman).
      return this.pull(branchCtx, undefined, entitiesCsv, caller);
    }

    const requested = this.resolveEntities(entitiesCsv, caller.isDevice);
    const updatedWhere = sinceDate ? { updatedAt: { gt: sinceDate } } : {};
    const changes: Record<string, unknown[]> = {};

    for (const entity of requested) {
      changes[entity] = await this.pullEntity(entity, updatedWhere, sinceDate, branchCtx);
    }

    return { serverTime, full, changes };
  }

  private resolveEntities(csv: string | undefined, isDevice: boolean): PullableEntity[] {
    // JWT hanya dapat entitas referensi; sisanya dibuang diam-diam.
    const allowed = isDevice ? PULLABLE_ENTITIES : PULLABLE_ENTITIES.filter((e) => WEB_PULLABLE_ENTITIES.has(e));
    if (!csv) return [...allowed];
    const set = new Set(csv.split(',').map((s) => s.trim()));
    const picked = allowed.filter((e) => set.has(e));
    if (picked.length) return picked;
    // Tak satu pun nama dikenal → perilaku lama (semua yang diizinkan).
    return PULLABLE_ENTITIES.some((e) => set.has(e)) ? [] : [...allowed];
  }

  private async pullEntity(
    entity: PullableEntity,
    _updatedWhere: Record<string, unknown>,
    sinceDate: Date | null,
    branchCtx: BranchContext,
  ): Promise<unknown[]> {
    const spec = ENTITY_REGISTRY[entity];
    if (!spec) return [];
    const where: Record<string, unknown> = {};
    // Scope cabang (mis. branchStocks) — device hanya tarik cabangnya; owner null = semua.
    if (spec.branchField && branchCtx.branchId != null) {
      where[spec.branchField] = branchCtx.branchId;
    }
    if (spec.branchOrGlobal && branchCtx.branchId != null) {
      where.OR = [{ [spec.branchOrGlobal]: branchCtx.branchId }, { [spec.branchOrGlobal]: null }];
    }
    // Delta hanya untuk model ber-updatedAt; model tanpa updatedAt (mis. roles) selalu full.
    if (spec.hasUpdatedAt && sinceDate) {
      where.updatedAt = { gt: sinceDate };
    }
    const delegate = (this.prisma as unknown as Record<string, { findMany: (a: unknown) => Promise<unknown[]> }>)[
      spec.delegate
    ];
    // Kolom rahasia (webhook, rclone) dibuang untuk SEMUA pemanggil.
    const omit = spec.omit?.length ? Object.fromEntries(spec.omit.map((f) => [f, true])) : undefined;
    return delegate.findMany(omit ? { where, omit } : { where });
  }

  /**
   * PUSH: terapkan mutasi offline secara idempoten (dedup via clientId).
   * - transaction.create → REUSE TransactionsService.create (invoice server-side,
   *   potong stok sebagai delta komutatif, buat cashflow — identik jalur online).
   * - cashflow.create → insert langsung (branch connect).
   * Error per-op tak menggagalkan op lain; op error TIDAK dicatat SyncedOp agar bisa
   * di-retry / ditinjau ulang oleh klien.
   */
  async push(
    branchCtx: BranchContext,
    ops: PushOp[],
    caller: SyncCaller = { isDevice: false, userId: null },
  ): Promise<PushResult> {
    const branchId = requireBranch(branchCtx);
    const results: PushOpResult[] = [];

    for (const op of ops) {
      try {
        results.push(await this.applyOp(op, branchId, branchCtx, caller));
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        this.logger.warn(`push op gagal (${op.type}, clientId=${op.clientId}): ${message}`);
        results.push({ clientId: op.clientId, status: 'error', message });
      }
    }

    return { serverTime: new Date().toISOString(), results };
  }

  private async applyOp(
    op: PushOp,
    branchId: number,
    branchCtx: BranchContext,
    caller: SyncCaller,
  ): Promise<PushOpResult> {
    if (!op.clientId) throw new Error('clientId wajib ada');

    // Idempotensi: kalau clientId sudah pernah diterapkan → balas serverId lama.
    const existing = await this.prisma.syncedOp.findUnique({ where: { clientId: op.clientId } });
    if (existing) {
      return { clientId: op.clientId, status: 'duplicate', serverId: existing.serverId ?? undefined };
    }

    switch (op.type) {
      case 'transaction.create': {
        const tx = await this.transactions.create({ ...op.payload, branchId });
        await this.recordOp(op.clientId, op.type, tx.id, branchId);
        return {
          clientId: op.clientId,
          status: 'applied',
          serverId: tx.id,
          invoiceNumber: (tx as { invoiceNumber?: string }).invoiceNumber,
        };
      }
      case 'cashflow.create': {
        const cf = await this.createCashflow(op.payload, branchId, caller);
        await this.recordOp(op.clientId, op.type, cf.id, branchId);
        return { clientId: op.clientId, status: 'applied', serverId: cf.id };
      }
      case 'stockPurchase.create': {
        // REUSE StockPurchasesService.create → stok +delta (BranchStock & agregat),
        // StockPurchaseItem, StockMovement IN. branchId dari device.
        const p = await this.stockPurchases.create(op.payload, branchCtx);
        await this.recordOp(op.clientId, op.type, p?.id ?? null, branchId);
        return { clientId: op.clientId, status: 'applied', serverId: p?.id };
      }
      case 'stockTransfer.create': {
        // REUSE StockTransfersService.createTransfer → pindah stok antar cabang +
        // 2 StockMovement (OUT/IN). Hasilnya referenceId (bukan id numerik) → serverId null.
        await this.stockTransfers.createTransfer(op.payload, branchCtx);
        await this.recordOp(op.clientId, op.type, null, branchId);
        return { clientId: op.clientId, status: 'applied' };
      }
      case 'stockOpname.finish': {
        // Set stok absolut tanpa sesi di pusat → hanya perangkat ber-token, bukan JWT.
        if (!caller.isDevice) {
          throw new Error('stockOpname.finish hanya diterima dari perangkat terdaftar');
        }
        // Sesi opname lokal tak ada di pusat → terapkan koreksi stok langsung
        // (set absolut per varian + StockMovement ADJUST). Idempoten (set absolut).
        const items = op.payload?.confirmedItems ?? [];
        await this.stockOpname.applyOfflineFinish(branchId, items, String(op.payload?.sessionId ?? 'offline'));
        await this.recordOp(op.clientId, op.type, null, branchId);
        return { clientId: op.clientId, status: 'applied' };
      }
      default:
        throw new Error(`Tipe op tak dikenal: ${(op as PushOp).type}`);
    }
  }

  /** Daftarkan perangkat baru (dipanggil owner via JWT) → token device rahasia. */
  async registerDevice(
    branchCtx: BranchContext,
    body: { name?: string; branchId?: number | null },
  ): Promise<{ deviceId: number; token: string; branchId: number | null }> {
    const raw = body.branchId !== undefined ? body.branchId : branchCtx.branchId;
    let branchId: number | null = null;
    if (raw != null) {
      branchId = Number(raw);
      if (!Number.isInteger(branchId) || branchId <= 0) throw new BadRequestException('branchId tidak valid');
      const branch = await this.prisma.companyBranch.findUnique({ where: { id: branchId }, select: { id: true } });
      if (!branch) throw new BadRequestException('Cabang tidak ditemukan');
    }
    const token = randomBytes(24).toString('hex'); // 48 hex
    const device = await this.prisma.device.create({
      data: { name: (body.name || 'Perangkat').slice(0, 120), branchId: branchId ?? null, token },
    });
    return { deviceId: device.id, token, branchId: device.branchId };
  }

  private async recordOp(
    clientId: string,
    type: string,
    serverId: number | null,
    branchId: number,
  ): Promise<void> {
    await this.prisma.syncedOp.create({ data: { clientId, type, serverId, branchId } });
  }

  // Insert cashflow manual dari device offline (pola branch connect seperti CashflowService).
  // userId dari payload DIABAIKAN (bisa dipalsukan) — pencatat = user JWT, perangkat = kosong.
  private async createCashflow(payload: any, branchId: number, caller: SyncCaller) {
    const {
      bankAccountId,
      userId: _userId,
      user: _user,
      branch: _branch,
      branchId: _branchId,
      bankAccount: _bankAccount,
      ...rest
    } = payload ?? {};
    return this.prisma.cashflow.create({
      data: {
        ...rest,
        branch: { connect: { id: branchId } },
        ...(caller.userId ? { user: { connect: { id: caller.userId } } } : {}),
        ...(bankAccountId ? { bankAccount: { connect: { id: bankAccountId } } } : {}),
      } as any,
    });
  }
}
