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
  private readonly bootstrapJwt = process.env.POSPRO_CENTRAL_TOKEN || ''; // JWT sekali-pakai utk daftar device
  private readonly branchId = process.env.POSPRO_BRANCH_ID || '';
  private deviceToken: string | null = null;

  constructor(private readonly prisma: PrismaService) {}

  private get enabled(): boolean {
    return !!process.env.POSPRO_LOCAL && !!this.centralUrl;
  }

  // Auth ke pusat pakai device token (bukan JWT). Registrasi sekali via JWT bootstrap,
  // token disimpan di SyncState → dipakai selamanya (tak kadaluarsa, bisa dicabut pusat).
  private async ensureDeviceToken(): Promise<string | null> {
    if (this.deviceToken) return this.deviceToken;
    const stored = await this.getState('deviceToken');
    if (stored) {
      this.deviceToken = stored;
      return stored;
    }
    if (!this.bootstrapJwt) return null; // belum ada cara mendaftar
    const res = await fetch(`${this.centralUrl}/sync/register-device`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.bootstrapJwt}`,
        'Content-Type': 'application/json',
        ...(this.branchId ? { 'X-Branch-Id': this.branchId } : {}),
      },
      body: JSON.stringify({
        name: process.env.POSPRO_DEVICE_NAME || 'POS Desktop',
        branchId: this.branchId ? Number(this.branchId) : undefined,
      }),
    });
    if (!res.ok) throw new Error(`register-device HTTP ${res.status}`);
    const data = (await res.json()) as { deviceId: number; token: string };
    await this.setState('deviceToken', data.token);
    this.deviceToken = data.token;
    this.logger.log(`perangkat terdaftar di pusat (id=${data.deviceId})`);
    return data.token;
  }

  private headers(): Record<string, string> {
    return { 'x-device-token': this.deviceToken || '', 'Content-Type': 'application/json' };
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
      const token = await this.ensureDeviceToken();
      if (!token) {
        this.logger.warn('device belum terdaftar (perlu POSPRO_CENTRAL_TOKEN sekali) → sync ditunda');
        return;
      }
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
