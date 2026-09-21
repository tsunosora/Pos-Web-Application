import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionsService } from '../transactions/transactions.service';
import { StockPurchasesService } from '../stock-purchases/stock-purchases.service';
import { StockTransfersService } from '../stock-transfers/stock-transfers.service';
import { StockOpnameService } from '../stock-opname/stock-opname.service';
import type { BranchContext } from '../common/branch-context.decorator';
import { pilihKolomKasManual } from '../cashflow/cashflow.service';
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
    const results: PushOpResult[] = [];

    for (const op of ops) {
      try {
        // Cabang = cabang tempat op DIBUAT (dikirim klien), bukan cabang aktif saat sinkron —
        // dulu nota offline cabang A masuk ke cabang B bila owner/akun lain aktif di B saat
        // koneksi kembali. Staf/perangkat bercabang hanya boleh cabangnya sendiri.
        let branchId: number;
        if (op.branchId != null) {
          const b = Number(op.branchId);
          if (!Number.isInteger(b) || b <= 0) throw new Error('cabang op tidak valid');
          if (!branchCtx.isOwner && b !== branchCtx.branchId) throw new Error('cabang op tidak cocok dengan akun/perangkat ini');
          branchId = b;
        } else {
          branchId = requireBranch(branchCtx);
        }
        const ctxOp: BranchContext = { ...branchCtx, branchId };
        results.push(await this.applyOp(op, branchId, ctxOp, caller));
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

    // Idempotensi: KLAIM clientId dulu, baru kerjakan. Dulu dicatat SETELAH nota dibuat → dua
    // push bersamaan (2 tab / kiriman ulang) sama-sama lolos cek dan nota tercatat dobel.
    const klaim = await this.claimOp(op.clientId, op.type, branchId);
    if (klaim !== 'baru') {
      return { clientId: op.clientId, status: 'duplicate', serverId: klaim.serverId ?? undefined };
    }
    let hasil: PushOpResult;
    try {
      hasil = await this.kerjakanOp(op, branchId, branchCtx, caller);
    } catch (e) {
      // Pekerjaan gagal (belum tersimpan) → lepas klaim supaya bisa dicoba lagi / ditinjau.
      await this.prisma.syncedOp.deleteMany({ where: { clientId: op.clientId, serverId: null } }).catch(() => {});
      throw e;
    }
    // Pekerjaan SUDAH tersimpan. Gagal mencatat hasilnya jangan melepas klaim — dulu klaim
    // dihapus lalu kiriman ulang menggandakan nota/stok (mis. pool DB habis saat disk lambat).
    await this.recordOp(op.clientId, op.type, hasil.serverId ?? null, branchId);
    return hasil;
  }

  /** 'baru' = klaim berhasil; selain itu baris lama (sudah/sedang diterapkan). Klaim macet > 10 menit dilepas. */
  private async claimOp(clientId: string, type: string, branchId: number): Promise<'baru' | { serverId: number | null }> {
    try {
      await this.prisma.syncedOp.create({ data: { clientId, type, serverId: null, branchId } });
      return 'baru';
    } catch (e: any) {
      if (e?.code !== 'P2002') throw e;
      const ada = await this.prisma.syncedOp.findUnique({ where: { clientId } });
      if (ada && ada.serverId == null && Date.now() - new Date(ada.createdAt).getTime() > 10 * 60_000
        && !['stockTransfer.create', 'stockOpname.finish'].includes(ada.type)) {
        // Proses sebelumnya mati di tengah jalan — ambil alih klaimnya.
        const r = await this.prisma.syncedOp.updateMany({ where: { clientId, serverId: null, createdAt: ada.createdAt }, data: { createdAt: new Date() } });
        if (r.count === 1) return 'baru';
      }
      return { serverId: ada?.serverId ?? null };
    }
  }

  private async kerjakanOp(
    op: PushOp,
    branchId: number,
    branchCtx: BranchContext,
    caller: SyncCaller,
  ): Promise<PushOpResult> {
    switch (op.type) {
      case 'transaction.create': {
        // Pencatat = akun login (bukan isi payload yang bisa dipalsukan). Waktu jual offline:
        // nota yang dibuat HARI LAIN (≤ 7 hari) memakai tanggal itu, bukan tanggal sinkron.
        const { actorUserId: _aktorPayload, branchId: _cabangPayload, ...payload } = op.payload ?? {};
        const tanggal = this.tanggalOffline(op.occurredAt);
        const tx = await this.transactions.create({
          ...payload,
          ...(tanggal && !payload.transactionDate ? { transactionDate: tanggal } : {}),
          branchId,
          actorUserId: caller.isDevice ? null : caller.userId ?? null,
        });
        return {
          clientId: op.clientId,
          status: 'applied',
          serverId: tx.id,
          invoiceNumber: (tx as { invoiceNumber?: string }).invoiceNumber,
        };
      }
      case 'cashflow.create': {
        const cf = await this.createCashflow(op.payload, branchId, caller);
        return { clientId: op.clientId, status: 'applied', serverId: cf.id };
      }
      case 'stockPurchase.create': {
        // REUSE StockPurchasesService.create → stok +delta (BranchStock & agregat),
        // StockPurchaseItem, StockMovement IN. branchId dari device.
        const p = await this.stockPurchases.create(op.payload, branchCtx);
        return { clientId: op.clientId, status: 'applied', serverId: p?.id };
      }
      case 'stockTransfer.create': {
        // REUSE StockTransfersService.createTransfer → pindah stok antar cabang +
        // 2 StockMovement (OUT/IN). Hasilnya referenceId (bukan id numerik) → serverId null.
        await this.stockTransfers.createTransfer(op.payload, branchCtx);
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
    // Klaim sudah dibuat di awal → isi hasilnya. Diulang beberapa kali (DB bisa sesaat tak
    // menjawab); bila tetap gagal hanya dicatat di log — klaimnya tetap ada, jadi kiriman
    // ulang dijawab "duplicate", bukan diterapkan dua kali.
    for (let coba = 1; coba <= 4; coba++) {
      try {
        await this.prisma.syncedOp.updateMany({ where: { clientId }, data: { serverId, type, branchId } });
        return;
      } catch (e) {
        if (coba === 4) {
          this.logger.error(`gagal mencatat hasil op ${clientId} (${type}, serverId=${serverId}): ${e instanceof Error ? e.message : e}`);
          return;
        }
        await new Promise((r) => setTimeout(r, 2000 * coba));
      }
    }
  }

  /** occurredAt (ISO) → 'YYYY-MM-DD' WIB bila HARI LAIN dari hari ini, ≤ 7 hari lalu & tidak di masa depan. */
  private tanggalOffline(occurredAt?: string): string | null {
    if (!occurredAt) return null;
    const t = new Date(occurredAt);
    const now = new Date();
    if (Number.isNaN(t.getTime()) || t > now || now.getTime() - t.getTime() > 7 * 24 * 3600 * 1000) return null;
    const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return ymd(t) === ymd(now) ? null : ymd(t);
  }

  // Insert cashflow manual dari device offline (pola branch connect seperti CashflowService).
  // userId dari payload DIABAIKAN (bisa dipalsukan) — pencatat = user JWT, perangkat = kosong.
  private async createCashflow(payload: any, branchId: number, caller: SyncCaller) {
    // Kolom sama dengan form Kas online (nominal > 0, tanpa tanggal/shift/relasi sisipan).
    const { bankAccountId, ...rest } = pilihKolomKasManual(payload);
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
