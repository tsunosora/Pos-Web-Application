import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// RcloneService membaca BACKUP_DIR saat modul di-load → arahkan ke folder sementara
// SEBELUM require, supaya folder cadangan asli tidak tersentuh pengujian.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rclone-spec-'));
process.env.BACKUP_DIR = TMP;
/* eslint-disable @typescript-eslint/no-require-imports */
const { RcloneService } =
  require('./rclone.service') as typeof import('./rclone.service');

const SETTINGS = {
  id: 1,
  storeName: 'Voliko',
  rcloneRemote: 'remote:voliko',
  rcloneKeepCount: 14,
};

const make = (opts: { uploadFails?: boolean; archiveFails?: boolean } = {}) => {
  const prisma = {
    storeSettings: {
      findFirst: () => Promise.resolve(SETTINGS),
      update: () => Promise.resolve(SETTINGS),
    },
  };
  const backupService = {
    writeBackupToFile: (p: string) => {
      fs.writeFileSync(p, opts.archiveFails ? 'zip-separuh' : 'zip-lengkap');
      return opts.archiveFails
        ? Promise.reject(new Error('disk penuh'))
        : Promise.resolve();
    },
  };
  const discord = { notifyBackup: jest.fn() };
  const scheduler = {
    deleteCronJob: () => undefined,
    addCronJob: () => undefined,
  };
  const svc = new RcloneService(
    prisma as never,
    backupService as never,
    scheduler as never,
    discord as never,
  );
  (svc as unknown as { runRcloneCopy: () => Promise<void> }).runRcloneCopy =
    () =>
      opts.uploadFails
        ? Promise.reject(new Error('rclone tidak ada kemajuan 10 menit'))
        : Promise.resolve();
  return { svc, discord };
};

const zips = () => fs.readdirSync(TMP).filter((f) => f.endsWith('.zip'));

afterEach(() => zips().forEach((f) => fs.unlinkSync(path.join(TMP, f))));

describe('RcloneService.runBackup — cadangan lokal tidak ikut hilang', () => {
  it('unggah gagal → zip yang sudah selesai TETAP disimpan', async () => {
    const { svc, discord } = make({ uploadFails: true });
    const res = await svc.runBackup();
    expect(res.success).toBe(false);
    expect(zips()).toHaveLength(1); // dulu bug: berkas ini terhapus
    expect(res.message).toMatch(/Cadangan lokal tetap ada/i);
    expect(svc.getProgress().phase).toMatch(/lokal aman/i);
    expect(discord.notifyBackup).toHaveBeenCalledWith(
      expect.objectContaining({ ok: false }),
    );
  });

  it('pembuatan zip gagal → berkas separuh dibuang', async () => {
    const { svc } = make({ archiveFails: true });
    const res = await svc.runBackup();
    expect(res.success).toBe(false);
    expect(zips()).toHaveLength(0);
  });

  it('berhasil → zip tersimpan & progres 100%', async () => {
    const { svc } = make();
    const res = await svc.runBackup();
    expect(res.success).toBe(true);
    expect(zips()).toHaveLength(1);
    expect(svc.getProgress().percent).toBe(100);
    expect(svc.getProgress().ok).toBe(true);
  });
});
