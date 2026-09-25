import { HrSummaryService } from './hr-summary.service';

/** Prisma tiruan: hanya tabel designer yang dipakai jalur PIN. */
const prismaPalsu = (designer: unknown = null) =>
  ({ designer: { findUnique: () => Promise.resolve(designer) } }) as never;

/**
 * Kartu HR hanya pelengkap: kalau RateMyStaff mati/lambat, dashboard PosPro
 * TIDAK boleh ikut rusak. Tes ini mengunci perilaku itu + cache-nya.
 */
const CONTOH = {
  date: '2026-09-19',
  attendance: {
    employees: 16,
    present: 12,
    onTime: 6,
    late: 6,
    leave: 0,
    notYetIn: 4,
    rate: 75,
  },
  lateToday: [{ name: 'Jono', clockIn: '09:44', lateMinutes: 104 }],
  pendingLeave: 0,
  points: {
    enabled: true,
    periodLabel: 'September 2026',
    top: [{ name: 'Gugun', points: 4856 }],
  },
};

const okResponse = () =>
  ({ ok: true, status: 200, json: () => Promise.resolve(CONTOH) }) as any;

describe('HrSummaryService', () => {
  const KEY_ASLI = process.env.HR_API_KEY;
  let svc: HrSummaryService;

  beforeEach(() => {
    process.env.HR_API_KEY = 'kunci-uji';
    svc = new HrSummaryService(prismaPalsu());
    jest.restoreAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterAll(() => {
    if (KEY_ASLI === undefined) delete process.env.HR_API_KEY;
    else process.env.HR_API_KEY = KEY_ASLI;
  });

  it('meneruskan data RateMyStaff dengan available: true dan mengirim kunci di header', async () => {
    const f = jest.fn(() => Promise.resolve(okResponse()));
    global.fetch = f as any;

    const out = await svc.summary();

    expect(out.available).toBe(true);
    expect(out.attendance?.present).toBe(12);
    expect(out.points?.top?.[0].name).toBe('Gugun');
    const [, init] = f.mock.calls[0] as any[];
    expect(init.headers['x-api-key']).toBe('kunci-uji');
  });

  it('hasil di-cache: panggilan kedua tidak menembak RateMyStaff lagi', async () => {
    const f = jest.fn(() => Promise.resolve(okResponse()));
    global.fetch = f as any;

    await svc.summary();
    await svc.summary();

    expect(f).toHaveBeenCalledTimes(1);
  });

  it('beberapa permintaan bersamaan hanya jadi satu panggilan keluar', async () => {
    const f = jest.fn(() => Promise.resolve(okResponse()));
    global.fetch = f as any;

    await Promise.all([svc.summary(), svc.summary(), svc.summary()]);

    expect(f).toHaveBeenCalledTimes(1);
  });

  it('RateMyStaff mati → available: false, TIDAK melempar error', async () => {
    global.fetch = jest.fn(() =>
      Promise.reject(new Error('ECONNREFUSED')),
    ) as any;

    const out = await svc.summary();

    expect(out.available).toBe(false);
    expect(out.reason).toBe('tidak bisa dihubungi');
  });

  it('jawaban 401/500 → available: false dengan keterangan status', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: false, status: 401 } as any),
    ) as any;

    const out = await svc.summary();

    expect(out).toMatchObject({ available: false, reason: 'HTTP 401' });
  });

  it('permintaan dibatalkan (timeout) → available: false, reason timeout', async () => {
    global.fetch = jest.fn(() =>
      Promise.reject(new Error('The operation was aborted')),
    ) as any;

    const out = await svc.summary();

    expect(out).toMatchObject({ available: false, reason: 'timeout' });
  });

  it('kunci belum diisi → tidak memanggil RateMyStaff sama sekali', async () => {
    delete process.env.HR_API_KEY;
    const f = jest.fn();
    global.fetch = f as any;

    const out = await svc.summary();

    expect(f).not.toHaveBeenCalled();
    expect(out.available).toBe(false);
    expect(out.reason).toMatch(/HR_API_KEY/);
  });

  it('kegagalan hanya di-cache sebentar, lalu dicoba lagi', async () => {
    const gagal = jest.fn(() => Promise.reject(new Error('ECONNREFUSED')));
    global.fetch = gagal as any;
    await svc.summary();

    // Majukan waktu 20 detik: lewat cache-gagal (15 dtk), belum lewat cache-sukses (60 dtk).
    const asli = Date.now;
    Date.now = () => asli() + 20_000;
    try {
      global.fetch = jest.fn(() => Promise.resolve(okResponse())) as any;
      const out = await svc.summary();
      expect(out.available).toBe(true);
    } finally {
      Date.now = asli;
    }
  });
});

describe('HrSummaryService.myPortal — tautan portal pribadi', () => {
  const KEY_ASLI = process.env.HR_API_KEY;
  let svc: HrSummaryService;
  const portal = {
    found: true,
    name: 'Gugun',
    portalUrl: 'https://absensi.contoh-toko.com/me/tok-123',
    hasPin: true,
  };

  beforeEach(() => {
    process.env.HR_API_KEY = 'kunci-uji';
    svc = new HrSummaryService(prismaPalsu());
    jest.restoreAllMocks();
  });
  afterAll(() => {
    if (KEY_ASLI === undefined) delete process.env.HR_API_KEY;
    else process.env.HR_API_KEY = KEY_ASLI;
  });

  it('meminta tautan memakai id dari pemanggil & mengembalikan datanya', async () => {
    const f = jest.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(portal),
      } as any),
    );
    global.fetch = f as any;

    const out = await svc.myPortal(18);

    expect(out).toEqual(portal);
    const [url, init] = f.mock.calls[0] as any[];
    expect(String(url)).toContain('/my-portal?posproUserId=18');
    expect(String(url)).not.toContain('hr-summary');
    expect(init.headers['x-api-key']).toBe('kunci-uji');
  });

  it('hasil di-cache per orang, tidak tercampur antar pengguna', async () => {
    const f = jest.fn((u: any) =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ ...portal, name: String(u) }),
      } as any),
    );
    global.fetch = f as any;

    await svc.myPortal(18);
    await svc.myPortal(18);
    expect(f).toHaveBeenCalledTimes(1);

    const lain = await svc.myPortal(19);
    expect(f).toHaveBeenCalledTimes(2);
    expect(lain.name).toContain('posproUserId=19');
  });

  it('karyawan belum dipetakan → found: false (tidak di-cache sebagai tautan)', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ found: false }),
      } as any),
    ) as any;
    expect(await svc.myPortal(99)).toEqual({ found: false });
  });

  it('RateMyStaff mati / id tidak masuk akal → found: false, tanpa error', async () => {
    global.fetch = jest.fn(() =>
      Promise.reject(new Error('ECONNREFUSED')),
    ) as any;
    expect(await svc.myPortal(18)).toEqual({ found: false });

    const f = jest.fn();
    global.fetch = f as any;
    expect(await svc.myPortal(0)).toEqual({ found: false });
    expect(await svc.myPortal(NaN)).toEqual({ found: false });
    expect(f).not.toHaveBeenCalled();
  });
});

describe('HrSummaryService.myPortalByPin — halaman kerja ber-PIN', () => {
  const KEY_ASLI = process.env.HR_API_KEY;
  const portal = {
    found: true,
    name: 'Gesang',
    portalUrl: 'https://absensi.contoh-toko.com/me/tok-9',
    hasPin: true,
  };

  beforeEach(() => {
    process.env.HR_API_KEY = 'kunci-uji';
    jest.restoreAllMocks();
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(portal),
      } as never),
    ) as never;
  });
  afterAll(() => {
    if (KEY_ASLI === undefined) delete process.env.HR_API_KEY;
    else process.env.HR_API_KEY = KEY_ASLI;
  });

  it('PIN benar & sudah tertaut akun → dapat tautan portalnya sendiri', async () => {
    const svc = new HrSummaryService(
      prismaPalsu({ id: 12, pin: '1234', isActive: true, userId: 24 }),
    );
    await expect(svc.myPortalByPin(12, '1234')).resolves.toEqual(portal);
  });

  it('PIN salah → ditolak, dan RateMyStaff tidak dihubungi sama sekali', async () => {
    const svc = new HrSummaryService(
      prismaPalsu({ id: 12, pin: '1234', isActive: true, userId: 24 }),
    );
    await expect(svc.myPortalByPin(12, '9999')).rejects.toThrow('PIN salah.');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('PIN sudah dinonaktifkan (karyawan keluar) → ditolak', async () => {
    const svc = new HrSummaryService(
      prismaPalsu({ id: 12, pin: '1234', isActive: false, userId: 24 }),
    );
    await expect(svc.myPortalByPin(12, '1234')).rejects.toThrow('PIN salah.');
  });

  it('PIN benar tapi belum tertaut akun login → found: false (kartu disembunyikan)', async () => {
    const svc = new HrSummaryService(
      prismaPalsu({ id: 3, pin: '1234', isActive: true, userId: null }),
    );
    await expect(svc.myPortalByPin(3, '1234')).resolves.toEqual({
      found: false,
    });
  });

  it('id/pin tidak masuk akal → ditolak tanpa menyentuh database', async () => {
    const svc = new HrSummaryService(
      prismaPalsu({ id: 12, pin: '1234', isActive: true, userId: 24 }),
    );
    await expect(svc.myPortalByPin(0, '1234')).rejects.toThrow('PIN salah.');
    await expect(svc.myPortalByPin(12, '')).rejects.toThrow('PIN salah.');
  });
});
