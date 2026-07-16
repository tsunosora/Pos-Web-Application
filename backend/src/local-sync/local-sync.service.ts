import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ENTITY_REGISTRY } from '../sync/dto';

// Sync client di BACKEND LOKAL (aktif hanya saat POSPRO_LOCAL). Bertindak sebagai
// klien endpoint /sync/* di server PUSAT:
//  - pullMaster: tarik master (produk/user/dll) → upsert DB lokal (PK dipertahankan).
//  - pushLocal: dorong transaksi lokal (antrean SyncPush) → pusat (idempoten clientId).
//  - bootstrap: saat DB lokal kosong → full pull (seed awal). Login offline butuh users
//    ter-seed (termasuk passwordHash).
@Injectable()
export class LocalSyncService implements OnModuleInit {
  private readonly logger = new Logger(LocalSyncService.name);
  private running = false;

  private readonly centralUrl = (process.env.POSPRO_CENTRAL_URL || '').replace(/\/$/, '');
  private readonly token = process.env.POSPRO_CENTRAL_TOKEN || '';
  private readonly branchId = process.env.POSPRO_BRANCH_ID || '';

  constructor(private readonly prisma: PrismaService) {}

  private get enabled(): boolean {
    return !!process.env.POSPRO_LOCAL && !!this.centralUrl && !!this.token;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      'Content-Type': 'application/json',
    };
    if (this.branchId) h['X-Branch-Id'] = this.branchId;
    return h;
  }

  async onModuleInit(): Promise<void> {
    if (!this.enabled) return;
    this.logger.log(`local-sync aktif → pusat ${this.centralUrl}`);
    // Bootstrap awal (jangan blokir boot bila offline).
    void this.syncTick(true);
  }

  @Interval(30000)
  async scheduled(): Promise<void> {
    await this.syncTick(false);
  }

  async syncTick(bootstrap: boolean): Promise<void> {
    if (!this.enabled || this.running) return;
    this.running = true;
    try {
      if (bootstrap && (await this.isEmpty())) {
        this.logger.log('DB lokal kosong → bootstrap full pull dari pusat…');
      }
      await this.pushLocal();
      await this.pullMaster();
    } catch (e) {
      this.logger.warn(`syncTick gagal: ${e instanceof Error ? e.message : e}`);
    } finally {
      this.running = false;
    }
  }

  private async isEmpty(): Promise<boolean> {
    try {
      return (await this.prisma.user.count()) === 0;
    } catch {
      return true;
    }
  }

  // ---- PULL master → DB lokal ----
  async pullMaster(): Promise<void> {
    const since = await this.getState('pullCursor');
    const url = `${this.centralUrl}/sync/pull${since ? `?since=${encodeURIComponent(since)}` : ''}`;
    const res = await fetch(url, { headers: this.headers() });
    if (!res.ok) throw new Error(`pull HTTP ${res.status}`);
    const data = (await res.json()) as { serverTime: string; changes: Record<string, any[]> };
    await this.applyPull(data.changes);
    await this.setState('pullCursor', data.serverTime);
  }

  private async applyPull(changes: Record<string, any[]>): Promise<void> {
    // Matikan FK checks selama apply (data dari pusat konsisten; hindari masalah
    // urutan & self-reference). Andalkan connection_limit=1 di DATABASE_URL lokal
    // agar SET session persist antar-query.
    await this.prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS=0');
    try {
      let total = 0;
      for (const entity of Object.keys(ENTITY_REGISTRY)) {
        const rows = changes[entity];
        if (!Array.isArray(rows) || rows.length === 0) continue;
        const delegate = (this.prisma as any)[ENTITY_REGISTRY[entity].delegate];
        for (const row of rows) {
          const { id, ...rest } = row;
          await delegate.upsert({ where: { id }, create: row, update: rest });
          total++;
        }
      }
      if (total) this.logger.log(`pull: ${total} baris master ter-upsert ke DB lokal`);
    } finally {
      await this.prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS=1');
    }
  }

  // ---- PUSH transaksional lokal → pusat ----
  async pushLocal(): Promise<void> {
    const pending = await this.prisma.syncPush.findMany({ where: { pushedAt: null }, take: 50 });
    if (!pending.length) return;
    const ops = pending.map((p) => ({ clientId: p.clientId, type: p.type, payload: p.payload }));
    const res = await fetch(`${this.centralUrl}/sync/push`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ ops }),
    });
    if (!res.ok) throw new Error(`push HTTP ${res.status}`);
    const data = (await res.json()) as { results: { clientId: string; status: string; serverId?: number }[] };
    let ok = 0;
    for (const r of data.results) {
      if (r.status === 'applied' || r.status === 'duplicate') {
        await this.prisma.syncPush.update({
          where: { clientId: r.clientId },
          data: { pushedAt: new Date(), centralId: r.serverId ?? null },
        });
        ok++;
      }
    }
    if (ok) this.logger.log(`push: ${ok}/${pending.length} transaksi lokal terkirim ke pusat`);
  }

  // ---- SyncState (cursor) ----
  private async getState(key: string): Promise<string | undefined> {
    const row = await this.prisma.syncState.findUnique({ where: { key } });
    return row?.value;
  }

  private async setState(key: string, value: string): Promise<void> {
    await this.prisma.syncState.upsert({ where: { key }, create: { key, value }, update: { value } });
  }
}
