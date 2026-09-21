jest.mock('./piket-pdf.render', () => ({
  renderPiketPdf: jest.fn((html: string) =>
    Promise.resolve(Buffer.from(`%PDF-${html.length}`)),
  ),
  stampLabel: () => '15/09/2026 21.40',
}));

import { renderPiketPdf } from './piket-pdf.render';
import {
  buildPiketPdfHtml,
  displayName,
  PDF_STAMP,
  PiketPdfInput,
  PiketPdfTask,
  splitTitle,
  steps,
} from './piket-pdf.template';
import { TaskPiketService } from './task-piket.service';
import { periodKeyFor } from './recurrence.util';

const SEMUA = 'Piket Pusat — semua karyawan';
const TINGGAL = 'Piket Pusat — tinggal di toko';
const START = new Date(2026, 8, 15);
const ORDER = ['BUDI', 'Cakra', 'DEWI', 'Eka'];

const task = (over: Partial<PiketPdfTask>): PiketPdfTask => ({
  id: 1,
  title: 'x',
  description: null,
  timeOfDay: null,
  frequency: 'DAILY',
  daysOfWeek: null,
  ...over,
});
const shift = (over: Partial<PiketPdfTask>) =>
  task({
    frequency: 'WEEKLY',
    daysOfWeek: '1,2,3,4,5,6',
    startDate: START,
    groupName: SEMUA,
    ...over,
  });

/** 4 pekan mulai Senin 14 Sep 2026, jangkar giliran 13 Sep (sama dgn data asli). */
function rotation(): NonNullable<PiketPdfInput['rotation']> {
  const weeks = [];
  for (let w = 0; w < 4; w++) {
    const days = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(2026, 8, 14 + w * 7 + d);
      days.push({
        date: periodKeyFor(date),
        iso: d + 1,
        name: ORDER[(1 + w * 7 + d) % 4],
        active: true,
      });
    }
    weeks.push({ start: days[0].date, days });
  }
  return { order: ORDER, weeks };
}

const input = (over: Partial<PiketPdfInput> = {}): PiketPdfInput => ({
  dateKey: '2026-09-15',
  trialUntil: '2026-09-20',
  remindBeforeMin: 15,
  graceMin: 15,
  shiftMembers: ['Ayu Lestari', 'Fajar', 'BUDI', 'Cakra', 'DEWI'],
  shiftTasks: [
    shift({
      id: 12,
      title: 'Buka toko',
      timeOfDay: '08:30',
      slot: 'PAGI',
      description: '1. Buka pintu.\n2. Nyalakan lampu.',
    }),
    shift({
      id: 13,
      title: 'Sapu halaman toko',
      timeOfDay: '09:00',
      slot: 'PAGI',
    }),
    shift({
      id: 14,
      title: 'Bersihkan area kerja',
      timeOfDay: '09:00',
      slot: 'PAGI',
      description: '1. Lap meja.',
    }),
    shift({
      id: 15,
      title: 'Bersihkan area kerja',
      timeOfDay: '20:45',
      slot: 'KEDUA',
      description: '1. Lap meja.',
    }),
    shift({ id: 16, title: 'Tutup toko', timeOfDay: '21:15', slot: 'KEDUA' }),
  ],
  groupTasks: [
    task({
      id: 17,
      title: 'Rapikan tempat tidur',
      timeOfDay: '08:15',
      startDate: START,
      groupName: TINGGAL,
      members: ORDER,
    }),
  ],
  rotationTasks: [
    task({
      id: 18,
      title: 'Buang sampah dapur (pagi)',
      timeOfDay: '09:00',
      description: '1. Kumpulkan sampah.',
    }),
    task({
      id: 21,
      title: 'Bersihkan toilet',
      timeOfDay: '12:00',
      frequency: 'WEEKLY',
      daysOfWeek: '7',
    }),
    task({ id: 19, title: 'Buang sampah dapur (sore)', timeOfDay: '17:00' }),
    task({ id: 20, title: 'Sapu & pel dapur', timeOfDay: '17:00' }),
  ],
  rotation: rotation(),
  ...over,
});

describe('buildPiketPdfHtml — kertas jadwal otomatis', () => {
  const html = buildPiketPdfHtml(input());

  it('kepala: tanggal mulai & masa uji coba dari data', () => {
    expect(html).toContain('Berlaku mulai Selasa, 15 September 2026');
    expect(html).toContain('Uji coba s/d Min 20 Sep');
    expect(html).toContain('Mulai Senin, 21 September 2026 berlaku penuh.');
    expect(html).toContain('muncul 15 menit sebelum jam batas');
    const tanpa = buildPiketPdfHtml(input({ trialUntil: null }));
    expect(tanpa).not.toContain('Uji coba');
  });

  it('A: tugas shift pagi/kedua + nama tidak tinggal vs tinggal', () => {
    expect(html).toContain('<li>Buka toko <span class="t">08.30</span></li>');
    expect(html).toContain('<li>Tutup toko <span class="t">21.15</span></li>');
    expect(html).toContain(
      '<b>Ayu Lestari · Fajar</b> <span class="sep">(tidak tinggal)</span> <b>· Budi · Cakra · Dewi</b>',
    );
  });

  it('B: sampah pagi & sore disatukan, harian dulu lalu toilet (Minggu)', () => {
    expect(html.split('<li>Buang sampah dapur').length - 1).toBe(1);
    expect(html).toContain(
      '<li>Buang sampah dapur <span class="t">09.00 &amp; 17.00</span></li>',
    );
    expect(html).toContain(
      '<li>Bersihkan toilet <span class="tag">Minggu</span> <span class="t">12.00</span></li>',
    );
    expect(html.indexOf('<li>Buang sampah dapur')).toBeLessThan(
      html.indexOf('<li>Sapu &amp; pel dapur'),
    );
    expect(html.indexOf('<li>Sapu &amp; pel dapur')).toBeLessThan(
      html.indexOf('<li>Bersihkan toilet'),
    );
    expect(html).toContain(
      '<p class="who"><b>Budi · Cakra · Dewi · Eka</b></p>',
    );
  });

  it('C: tabel giliran 4 pekan sama dengan kertas + tanggal ulang', () => {
    expect(html).toContain('Pekan 1<small>mulai 14 Sep</small>');
    expect(html).toContain('Pekan 4<small>mulai 5 Okt</small>');
    expect(html).toContain(
      '<tr><th>Senin</th><td class="n2">Cakra</td><td class="n1">Budi</td><td class="n4">Eka</td><td class="n3">Dewi</td></tr>',
    );
    expect(html).toContain(
      '<tr class="sun"><th>Minggu<small>+ bersihkan toilet</small></th><td class="n4">Eka</td><td class="n3">Dewi</td><td class="n2">Cakra</td><td class="n1">Budi</td></tr>',
    );
    expect(html).toContain('<b>Pekan 1</b>14 Sep · 12 Okt<br>9 Nov · 7 Des');
    expect(html).toContain('<b>Pekan 4</b>5 Okt · 2 Nov<br>30 Nov · 28 Des');
    expect(html).toContain('Dalam 4 pekan setiap orang bertugas 7 hari.');
    expect(html).not.toMatch(/>BUDI</);
  });

  it('halaman 2: rincian & jam batas per tugas', () => {
    expect(html).toContain(
      '<h3>Buka toko<span>SHIFT PAGI · BATAS 08.30</span></h3><ol><li>Buka pintu.</li><li>Nyalakan lampu.</li></ol>',
    );
    expect(html).toContain(
      '<span>SHIFT PAGI BATAS 09.00 · SHIFT KEDUA BATAS 20.45</span>',
    );
    expect(html).toContain(
      '<span>YANG TINGGAL DI TOKO · SETIAP HARI · BATAS 08.15</span>',
    );
    expect(html).toContain(
      '<span>PETUGAS HARIAN · PAGI 09.00 · SORE 17.00</span>',
    );
    expect(html).toContain(
      '<div class="card wide" style="--c:var(--tinggal)"><h3>Bersihkan toilet<span>PETUGAS HARI MINGGU · BATAS 12.00</span></h3>',
    );
    expect(html).toContain(PDF_STAMP);
  });

  it('teks dari jadwal di-escape (tidak bisa menyisipkan HTML)', () => {
    const x = buildPiketPdfHtml(
      input({
        groupTasks: [
          task({
            id: 30,
            title: '<img src=x onerror=alert(1)>',
            groupName: TINGGAL,
            description: '<script>1</script>',
          }),
        ],
      }),
    );
    expect(x).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(x).not.toContain('<img');
    expect(x).not.toContain('<script>');
  });

  it('tanpa giliran & tugas tinggal → hanya bagian A', () => {
    const x = buildPiketPdfHtml(
      input({ rotation: null, rotationTasks: [], groupTasks: [] }),
    );
    expect(x).toContain('A. Kewajiban semua karyawan');
    expect(x).not.toContain('Tambahan untuk');
    expect(x).not.toContain('Giliran petugas harian');
  });

  it('helper judul, langkah & nama', () => {
    expect(splitTitle('Buang sampah dapur (sore)')).toEqual({
      base: 'Buang sampah dapur',
      part: 'sore',
    });
    expect(splitTitle('Tutup toko')).toEqual({
      base: 'Tutup toko',
      part: null,
    });
    expect(steps('1. A\n\n2) B\n- C')).toEqual(['A', 'B', 'C']);
    expect(displayName('DEWI')).toBe('Dewi');
    expect(displayName('Eka')).toBe('Eka');
  });
});

describe('TaskPiketService.piketPdf — dibuat ulang hanya bila isi berubah', () => {
  const make = () => {
    // Nama toko & cabang untuk kepala kertas diambil dari Profil Toko (T-34).
    const prisma = {
      storeSettings: { findFirst: jest.fn().mockResolvedValue({ storeName: 'Toko Uji' }) },
      companyBranch: { findUnique: jest.fn().mockResolvedValue({ name: 'Pusat' }) },
    };
    const svc = new TaskPiketService(prisma as any, {} as any);
    let data: PiketPdfInput = input();
    jest
      .spyOn(svc, 'piketBoard')
      .mockImplementation(() => Promise.resolve(data as never));
    jest.spyOn(svc, 'piketSignatures').mockResolvedValue([]); // tanda tangan diuji terpisah
    return { svc, set: (d: PiketPdfInput) => (data = d) };
  };
  beforeEach(() => (renderPiketPdf as jest.Mock).mockClear());

  it('isi sama → dari cache; uji coba berubah → render ulang; stempel waktu terisi', async () => {
    const { svc, set } = make();
    const a = await svc.piketPdf(1);
    const b = await svc.piketPdf(1);
    expect(b).toBe(a);
    expect(renderPiketPdf).toHaveBeenCalledTimes(1);
    const sent = (renderPiketPdf as jest.Mock<Promise<Buffer>, [string]>).mock
      .calls[0][0];
    expect(sent).not.toContain(PDF_STAMP);
    expect(sent).toContain('Dibuat otomatis dari aplikasi · 15/09/2026 21.40');
    set(input({ trialUntil: null }));
    await svc.piketPdf(1);
    expect(renderPiketPdf).toHaveBeenCalledTimes(2);
  });

  it('permintaan bersamaan → sekali render', async () => {
    const { svc } = make();
    const [x, y] = await Promise.all([svc.piketPdf(1), svc.piketPdf(1)]);
    expect(y).toBe(x);
    expect(renderPiketPdf).toHaveBeenCalledTimes(1);
  });
});

describe('tanda tangan PDF (diatur di Pengaturan)', () => {
  it('orang → nama akun, jabatan → nama jabatan, kosong → titik-titik', () => {
    const html = buildPiketPdfHtml(
      input({
        signatures: [
          { label: 'Dibuat oleh', name: 'Eka' },
          { label: 'Mengetahui', name: 'Manajer Toko' },
          { label: 'Diperiksa', name: null },
        ],
      }),
    );
    expect(html).toContain('<div>Dibuat oleh,<i></i><b>Eka</b></div>');
    expect(html).toContain('<div>Mengetahui,<i></i><b>Manajer Toko</b></div>');
    expect(html).toContain('<div>Diperiksa,<i></i><b>…………………………</b></div>');
  });

  it('belum diatur → dua slot titik-titik, tanpa nama apa pun di kode', () => {
    const html = buildPiketPdfHtml(input());
    expect(html).toContain('<div>Dibuat oleh,<i></i><b>…………………………</b></div>');
    expect(html).toContain('<div>Mengetahui,<i></i><b>…………………………</b></div>');
  });

  it('label & nama tetap di-escape', () => {
    const html = buildPiketPdfHtml(
      input({ signatures: [{ label: '<b>x', name: '<img src=x>' }] }),
    );
    expect(html).toContain('&lt;b&gt;x');
    expect(html).not.toContain('<img');
  });
});

describe('TaskPiketService.setPiketSignatures', () => {
  type Row = { id: number; name?: string; isActive?: boolean };
  type Where = { id: { in: number[] }; isActive?: boolean };
  const fake = (
    init: {
      piketSignatures?: string | null;
      users?: Row[];
      roles?: Row[];
    } = {},
  ) => {
    const store: { id: number; piketSignatures: string | null } = {
      id: 1,
      piketSignatures: init.piketSignatures ?? null,
    };
    const pick = (rows: Row[], where: Where) =>
      rows.filter(
        (r) =>
          where.id.in.includes(r.id) &&
          (where.isActive === undefined || r.isActive === where.isActive),
      );
    const db = {
      storeSettings: {
        findFirst: () => Promise.resolve(store),
        update: ({ data }: { data: Partial<typeof store> }) => {
          Object.assign(store, data);
          return Promise.resolve(store);
        },
      },
      user: {
        findMany: ({ where }: { where: Where }) =>
          Promise.resolve(pick(init.users ?? [], where)),
      },
      role: {
        findMany: ({ where }: { where: Where }) =>
          Promise.resolve(pick(init.roles ?? [], where)),
      },
    };
    return { store, db };
  };
  const svc = (f: ReturnType<typeof fake>, manager = true) =>
    new TaskPiketService(f.db as never, { canAssign: () => manager } as never);
  const ctx = {} as never;

  it('bukan owner/manajer → ditolak', async () => {
    await expect(
      svc(fake(), false).setPiketSignatures(ctx, []),
    ).rejects.toThrow(/owner\/manajer/i);
  });

  it('orang + jabatan sekaligus → ditolak', async () => {
    const f = fake({ users: [{ id: 9, isActive: true }], roles: [{ id: 2 }] });
    await expect(
      svc(f).setPiketSignatures(ctx, [{ label: 'x', userId: 9, roleId: 2 }]),
    ).rejects.toThrow(/jangan keduanya/i);
  });

  it('orang nonaktif atau jabatan tak ada → ditolak', async () => {
    const f = fake({ users: [{ id: 9, isActive: false }], roles: [] });
    await expect(
      svc(f).setPiketSignatures(ctx, [{ userId: 9 }]),
    ).rejects.toThrow(/tidak ditemukan atau nonaktif/i);
    await expect(
      svc(f).setPiketSignatures(ctx, [{ roleId: 7 }]),
    ).rejects.toThrow(/Jabatan yang dipilih tidak ditemukan/i);
  });

  it('lebih dari 3 slot → ditolak', async () => {
    await expect(
      svc(fake()).setPiketSignatures(ctx, [{}, {}, {}, {}]),
    ).rejects.toThrow(/Maksimal 3/);
  });

  it('valid → tersimpan & nama diambil dari akun/jabatan', async () => {
    const f = fake({
      users: [{ id: 9, isActive: true, name: 'Eka' }],
      roles: [{ id: 2, name: 'Manajer' }],
    });
    const s = svc(f);
    const res = await s.setPiketSignatures(ctx, [
      { label: 'Dibuat oleh', userId: 9 },
      { label: 'Mengetahui', roleId: 2 },
      { label: '' },
    ]);
    expect(res.signatures).toEqual([
      { label: 'Dibuat oleh', userId: 9, roleId: null },
      { label: 'Mengetahui', userId: null, roleId: 2 },
      { label: 'Tanda tangan', userId: null, roleId: null },
    ]);
    expect(await s.piketSignatures()).toEqual([
      { label: 'Dibuat oleh', name: 'Eka' },
      { label: 'Mengetahui', name: 'Manajer' },
      { label: 'Tanda tangan', name: null },
    ]);
  });

  it('JSON rusak di DB → dianggap kosong (PDF tetap bisa dibuat)', async () => {
    expect(
      await svc(fake({ piketSignatures: '{bukan json' })).piketSignSlots(),
    ).toEqual([]);
  });
});
