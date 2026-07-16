import { Injectable, Logger } from '@nestjs/common';
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
  type PullableEntity,
  type PullResult,
  type PushOp,
  type PushOpResult,
  type PushResult,
} from './dto';

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
  async pull(branchCtx: BranchContext, since?: string, entitiesCsv?: string): Promise<PullResult> {
    const serverTime = new Date().toISOString();
    const full = !since;
    const sinceDate = since ? new Date(since) : null;
    if (sinceDate && Number.isNaN(sinceDate.getTime())) {
      // Cursor tak valid → perlakukan sebagai pull penuh (aman).
      return this.pull(branchCtx, undefined, entitiesCsv);
    }

    const requested = this.resolveEntities(entitiesCsv);
    const updatedWhere = sinceDate ? { updatedAt: { gt: sinceDate } } : {};
    const changes: Record<string, unknown[]> = {};

    for (const entity of requested) {
      changes[entity] = await this.pullEntity(entity, updatedWhere, sinceDate, branchCtx);
    }

    return { serverTime, full, changes };
  }

  private resolveEntities(csv?: string): PullableEntity[] {
    if (!csv) return [...PULLABLE_ENTITIES];
    const set = new Set(csv.split(',').map((s) => s.trim()));
    const picked = PULLABLE_ENTITIES.filter((e) => set.has(e));
    return picked.length ? picked : [...PULLABLE_ENTITIES];
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
    // Delta hanya untuk model ber-updatedAt; model tanpa updatedAt (mis. roles) selalu full.
    if (spec.hasUpdatedAt && sinceDate) {
      where.updatedAt = { gt: sinceDate };
    }
    const delegate = (this.prisma as unknown as Record<string, { findMany: (a: unknown) => Promise<unknown[]> }>)[
      spec.delegate
    ];
    return delegate.findMany({ where });
  }

  /**
   * PUSH: terapkan mutasi offline secara idempoten (dedup via clientId).
   * - transaction.create → REUSE TransactionsService.create (invoice server-side,
   *   potong stok sebagai delta komutatif, buat cashflow — identik jalur online).
   * - cashflow.create → insert langsung (branch connect).
   * Error per-op tak menggagalkan op lain; op error TIDAK dicatat SyncedOp agar bisa
   * di-retry / ditinjau ulang oleh klien.
   */
  async push(branchCtx: BranchContext, ops: PushOp[]): Promise<PushResult> {
    const branchId = requireBranch(branchCtx);
    const results: PushOpResult[] = [];

    for (const op of ops) {
      try {
        results.push(await this.applyOp(op, branchId, branchCtx));
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        this.logger.warn(`push op gagal (${op.type}, clientId=${op.clientId}): ${message}`);
        results.push({ clientId: op.clientId, status: 'error', message });
      }
    }

    return { serverTime: new Date().toISOString(), results };
  }

  private async applyOp(op: PushOp, branchId: number, branchCtx: BranchContext): Promise<PushOpResult> {
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
        const cf = await this.createCashflow(op.payload, branchId);
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
    const branchId = body.branchId !== undefined ? body.branchId : branchCtx.branchId;
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
  private async createCashflow(payload: any, branchId: number) {
    const { bankAccountId, userId, ...rest } = payload ?? {};
    return this.prisma.cashflow.create({
      data: {
        ...rest,
        branch: { connect: { id: branchId } },
        ...(userId ? { user: { connect: { id: userId } } } : {}),
        ...(bankAccountId ? { bankAccount: { connect: { id: bankAccountId } } } : {}),
      } as any,
    });
  }
}
