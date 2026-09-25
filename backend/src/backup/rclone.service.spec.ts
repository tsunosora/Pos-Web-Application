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
  storeName: 'Toko Uji',
  rcloneRemote: 'remote:toko-uji',
  rcloneKeepCount: 14,
};

const make = (
  opts: {
    uploadFails?: boolean;
    archiveFails?: boolean;
    uploadsDirAda?: boolean;
    dbGagal?: boolean;
  } = {},
) => {
  const prisma = {
    storeSettings: {
      findFirst: () =>
        opts.dbGagal
          ? Promise.reject(new Error('Timed out fetching a new connection'))
          : Promise.resolve(SETTINGS),
      update: () => Promise.resolve(SETTINGS),
    },
  };
  const jejak = {
    includeImages: undefined as boolean | undefined,
    uploadsDisinkron: 0,
  };
  const backupService = {
    uploadsDir:
      opts.uploadsDirAda === false ? path.join(TMP, 'tidak-ada') : TMP,
    writeBackupToFile: (p: string, _cb?: unknown, includeImages = true) => {
      jejak.includeImages = includeImages;
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
  (
    svc as unknown as { runRcloneUploads: () => Promise<void> }
  ).runRcloneUploads = () => {
    jejak.uploadsDisinkron += 1;
    return Promise.resolve();
  };
  return { svc, discord, jejak };
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

describe('RcloneService.runBackup — progres tidak macet', () => {
  it('galat DB saat membaca pengaturan → running kembali false & cadangan berikutnya boleh jalan', async () => {
    const { svc } = make({ dbGagal: true });
    const res = await svc.runBackup();
    expect(res.success).toBe(false);
    expect(svc.getProgress().running).toBe(false);
    const lagi = await svc.runBackup();
    expect(lagi.message).not.toMatch(/sedang berjalan/i);
  });
});

describe('RcloneService.runBackup — gambar dicadangkan terpisah', () => {
  it('zip terjadwal dibuat TANPA gambar (hemat ±2 GB tulisan per backup)', async () => {
    const { svc, jejak } = make();
    await svc.runBackup();
    expect(jejak.includeImages).toBe(false);
  });

  it('gambar disinkron inkremental setelah zip terunggah', async () => {
    const { svc, jejak } = make();
    const res = await svc.runBackup();
    expect(res.success).toBe(true);
    expect(jejak.uploadsDisinkron).toBe(1);
    expect(res.message).toMatch(/gambar/i);
  });

  it('unggah zip gagal → sinkron gambar tidak ikut dijalankan', async () => {
    const { svc, jejak } = make({ uploadFails: true });
    await svc.runBackup();
    expect(jejak.uploadsDisinkron).toBe(0);
  });
});
