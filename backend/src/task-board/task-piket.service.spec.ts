import { TaskBoardService } from './task-board.service';
import {
  TaskPiketService,
  parseDateKey,
  selectAutoWarnItems,
  isTrialDay,
  AutoWarnCandidate,
} from './task-piket.service';
import { periodKeyFor, rotationAssigneeOn } from './recurrence.util';

const BUDI = 18, CAKRA = 19, DEWI = 24, FAISAL = 9;

describe('rotationAssigneeOn — cocok dengan kertas jadwal piket', () => {
  const rule = { rotationUserIds: `${BUDI},${CAKRA},${DEWI},${FAISAL}`, startDate: new Date(2026, 8, 21) };
  const on = (d: number, m = 8) => rotationAssigneeOn(rule, new Date(2026, m, d, 14, 30));

  it('Pekan 1 (21–27 Sep): Budi, Cakra, Dewi, Faisal, Budi, Cakra, Dewi', () => {
    expect([21, 22, 23, 24, 25, 26, 27].map((d) => on(d))).toEqual([BUDI, CAKRA, DEWI, FAISAL, BUDI, CAKRA, DEWI]);
  });
  it('Senin & Minggu pekan 2–4 sesuai tabel', () => {
    expect(on(28)).toBe(FAISAL); // Senin pekan 2
    expect(on(4, 9)).toBe(CAKRA); // Minggu pekan 2 (toilet)
    expect(on(5, 9)).toBe(DEWI); // Senin pekan 3
    expect(on(11, 9)).toBe(BUDI); // Minggu pekan 3
    expect(on(12, 9)).toBe(CAKRA); // Senin pekan 4
    expect(on(18, 9)).toBe(FAISAL); // Minggu pekan 4
    expect(on(19, 9)).toBe(BUDI); // kembali ke pekan 1
  });
  it('sebelum tanggal mulai tetap berputar mundur (tidak crash)', () => {
    expect(on(20)).toBe(FAISAL);
  });
});

describe('parseDateKey', () => {
  it('valid & tidak valid', () => {
    expect(periodKeyFor(parseDateKey('2026-09-21')!)).toBe('2026-09-21');
    expect(parseDateKey('2026-02-31')).toBeNull();
    expect(parseDateKey('21-09-2026')).toBeNull();
    expect(parseDateKey(undefined)).toBeNull();
  });
});

describe('selectAutoWarnItems', () => {
  const now = new Date(2026, 8, 21, 9, 0);
  const base = (over: Partial<AutoWarnCandidate>): AutoWarnCandidate => ({
    id: 1, title: 'Buka toko', status: 'TODO', dueDate: new Date(2026, 8, 21, 8, 30),
    createdAt: new Date(2026, 8, 21, 0, 5), assigneeId: 5, periodKey: '2026-09-21', ...over,
  });
  const opts = () => ({ warnedItemIds: new Set<number>(), liburKeys: new Set<string>() });

  it('lewat batas + 15 menit → ditegur; belum 15 menit → belum', () => {
    expect(selectAutoWarnItems([base({})], now, opts())).toHaveLength(1); // 30 menit lewat
    expect(selectAutoWarnItems([base({ dueDate: new Date(2026, 8, 21, 8, 50) })], now, opts())).toHaveLength(0);
  });
  it('DONE, sudah ditegur, atau LIBUR → dilewati', () => {
    expect(selectAutoWarnItems([base({ status: 'DONE' })], now, opts())).toHaveLength(0);
    expect(selectAutoWarnItems([base({})], now, { ...opts(), warnedItemIds: new Set([1]) })).toHaveLength(0);
    expect(selectAutoWarnItems([base({})], now, { ...opts(), liburKeys: new Set(['5|2026-09-21']) })).toHaveLength(0);
  });
  it('masa uji coba → tidak ditegur; sesudahnya → ditegur', () => {
    expect(isTrialDay('2026-09-20', '2026-09-20')).toBe(true);
    expect(isTrialDay('2026-09-21', '2026-09-20')).toBe(false);
    expect(selectAutoWarnItems([base({})], now, { ...opts(), trialUntil: '2026-09-21' })).toHaveLength(0);
    expect(selectAutoWarnItems([base({})], now, { ...opts(), trialUntil: '2026-09-20' })).toHaveLength(1);
  });
  it('kartu dibuat setelah batas (pilih shift terlambat) → toleransi dari saat dibuat', () => {
    const late = base({ createdAt: new Date(2026, 8, 21, 8, 55) });
    expect(selectAutoWarnItems([late], now, opts())).toHaveLength(0);
    expect(selectAutoWarnItems([late], new Date(2026, 8, 21, 9, 10), opts())).toHaveLength(1);
  });
});

/** Mock Prisma kecil yang menghormati filter yang dipakai service piket. */
function makeDb(schedules: any[], groups: Record<number, number[]>) {
  const items: any[] = [];
  const checkins = new Map<string, any>();
  const warnings: any[] = [];
  const slotOk = (s: any, w: any) =>
    w === undefined ? true : w === null ? !s.shiftSlot : w?.not === null ? !!s.shiftSlot : true;
  const inList = (v: any, f: any) => (f?.in ? f.in.includes(v) : true);
  return {
    items, checkins, warnings,
    storeSettings: { findFirst: jest.fn(async () => ({ piketTrialUntil: null })) },
    taskSchedule: {
      findMany: jest.fn(async ({ where = {} }: any = {}) =>
        schedules.filter((s) =>
          (where.isActive === undefined || s.isActive === where.isActive) &&
          slotOk(s, where.shiftSlot) &&
          (!where.frequency?.not || s.frequency !== where.frequency.not))),
    },
    taskGroupMember: {
      findMany: jest.fn(async ({ where }: any) => (groups[where.groupId] ?? []).map((userId) => ({ userId }))),
    },
    user: {
      findUnique: jest.fn(async ({ where }: any) => ({ id: where.id, branchId: 1, isActive: true, name: `U${where.id}` })),
      findMany: jest.fn(async () => []),
    },
    taskItem: {
      create: jest.fn(async ({ data }: any) => {
        if (items.some((i) => i.scheduleId === data.scheduleId && i.assigneeId === data.assigneeId && i.periodKey === data.periodKey)) {
          const e: any = new Error('dup'); e.code = 'P2002'; throw e;
        }
        // createdAt tetap (sebelum hari uji), bukan jam sungguhan: dulu test ini mulai gagal
        // sendiri sejak 21 Sep 2026 08.35 karena kartu terlihat "dibuat setelah batas".
        const row = { id: items.length + 1, createdAt: new Date(2026, 8, 20, 12, 0), ...data };
        items.push(row);
        return row;
      }),
      deleteMany: jest.fn(async ({ where }: any) => {
        const before = items.length;
        for (let i = items.length - 1; i >= 0; i--) {
          const it = items[i];
          if (it.assigneeId === where.assigneeId && it.periodKey === where.periodKey && it.status === where.status && inList(it.scheduleId, where.scheduleId))
            items.splice(i, 1);
        }
        return { count: before - items.length };
      }),
      findMany: jest.fn(async ({ where }: any) =>
        items.filter((i) => i.status !== 'DONE' && i.assigneeId != null && i.dueDate >= where.dueDate.gte && i.dueDate <= where.dueDate.lte &&
          (typeof where.assigneeId !== 'number' || i.assigneeId === where.assigneeId))),
    },
    taskShiftCheckin: {
      findUnique: jest.fn(async ({ where }: any) => checkins.get(`${where.userId_dateKey.userId}|${where.userId_dateKey.dateKey}`) ?? null),
      upsert: jest.fn(async ({ where, create, update }: any) => {
        const k = `${where.userId_dateKey.userId}|${where.userId_dateKey.dateKey}`;
        const row = checkins.has(k) ? { ...checkins.get(k), ...update } : { ...create, updatedAt: new Date() };
        checkins.set(k, row);
        return row;
      }),
      findMany: jest.fn(async ({ where }: any) =>
        [...checkins.values()].filter((c) => c.shift === where.shift && inList(c.userId, where.userId) && inList(c.dateKey, where.dateKey))),
    },
    taskWarning: {
      findMany: jest.fn(async ({ where }: any) => warnings.filter((w) => w.kind === where.kind && inList(w.taskItemId, where.taskItemId))),
      create: jest.fn(async ({ data }: any) => {
        if (data.kind === 'AUTO' && warnings.some((w) => w.kind === 'AUTO' && w.taskItemId === data.taskItemId)) {
          const e: any = new Error('dup'); e.code = 'P2002'; throw e;
        }
        const row = { id: warnings.length + 1, ...data };
        warnings.push(row);
        return row;
      }),
    },
  };
}

describe('TaskPiketService — pilih shift & teguran otomatis', () => {
  const monday = new Date(2026, 8, 21, 7, 50);
  const schedules = [
    { id: 1, title: 'Buka toko', frequency: 'WEEKLY', daysOfWeek: '1,2,3,4,5,6', timeOfDay: '08:30', priority: 'HIGH', isActive: true, groupId: 7, shiftSlot: 'PAGI', branchId: 1 },
    { id: 2, title: 'Tutup toko', frequency: 'WEEKLY', daysOfWeek: '1,2,3,4,5,6', timeOfDay: '21:15', priority: 'HIGH', isActive: true, groupId: 7, shiftSlot: 'KEDUA', branchId: 1 },
    { id: 3, title: 'Sapu & pel dapur', frequency: 'DAILY', timeOfDay: '17:00', priority: 'NORMAL', isActive: true, rotationUserIds: `${BUDI},${CAKRA},${DEWI},${FAISAL}`, startDate: new Date(2026, 8, 21), shiftSlot: null, branchId: 1 },
  ];
  const setup = () => {
    const db = makeDb(schedules, { 7: [5, 6] });
    const board = new TaskBoardService(db as any);
    return { db, board, piket: new TaskPiketService(db as any, board) };
  };

  it('myDay: anggota grup shift wajib pilih shift; orang lain tidak', async () => {
    const { piket } = setup();
    const d5 = await piket.myDay(5, monday);
    expect(d5.needsCheckin).toBe(true);
    expect(d5.slots.sort()).toEqual(['KEDUA', 'PAGI']);
    expect((await piket.myDay(99, monday)).needsCheckin).toBe(false);
  });

  it('pilih PAGI → hanya kartu shift pagi milik sendiri; ganti KEDUA → kartu pagi TODO dihapus; LIBUR → kosong', async () => {
    const { piket, db } = setup();
    const r1 = await piket.checkin(5, 'PAGI', monday);
    expect(r1).toMatchObject({ created: 1, removed: 0 });
    expect(db.items.map((i) => [i.title, i.assigneeId])).toEqual([['Buka toko', 5]]);

    const r2 = await piket.checkin(5, 'KEDUA', monday);
    expect(r2).toMatchObject({ created: 1, removed: 1 });
    expect(db.items.map((i) => i.title)).toEqual(['Tutup toko']);

    const r3 = await piket.checkin(5, 'LIBUR', monday);
    expect(r3).toMatchObject({ created: 0, removed: 1 });
    expect(db.items).toHaveLength(0);
    expect((await piket.myDay(5, monday)).checkin?.shift).toBe('LIBUR');
  });

  it('owner tidak diminta memilih shift & tidak masuk tugas shift', async () => {
    const { piket, db } = setup();
    (db.user as any).findMany = jest.fn(async () => [{ id: 6, role: { name: 'Owner' } }, { id: 5, role: { name: 'Designer' } }]);
    expect((await piket.myDay(6, monday)).needsCheckin).toBe(false);
    expect((await piket.myDay(5, monday)).needsCheckin).toBe(true);
    await expect(piket.checkin(6, 'PAGI', monday)).rejects.toThrow('Tidak ada jadwal piket shift');
    const plan = await piket.planFor(1, new Date(2026, 8, 22), false);
    expect(plan.rows.filter((r) => r.needsShift).map((r) => r.userId)).toEqual([5]);
  });

  it('pilih shift tanpa jadwal shift → ditolak', async () => {
    const { piket } = setup();
    await expect(piket.checkin(99, 'PAGI', monday)).rejects.toThrow('Tidak ada jadwal piket shift');
  });

  it('generateDue melewati jadwal shift & giliran jatuh ke petugas hari itu', async () => {
    const { board, db } = setup();
    const r = await board.generateDue(new Date(2026, 8, 24)); // Kamis pekan 1 → Faisal
    expect(r.created).toBe(1);
    expect(db.items.map((i) => [i.title, i.assigneeId])).toEqual([['Sapu & pel dapur', FAISAL]]);
  });

  it('rencana tanggal mendatang: giliran jatuh ke orangnya, tugas shift sebagai pilihan', async () => {
    const { piket } = setup();
    const plan = await piket.planFor(1, new Date(2026, 8, 22), false); // Selasa → giliran ke-2 (Cakra)
    expect(Object.keys(plan.shiftOptions).sort()).toEqual(['KEDUA', 'PAGI']);
    expect(plan.rows.find((r) => r.userId === CAKRA)?.tasks.map((t) => t.title)).toEqual(['Sapu & pel dapur']);
    expect(plan.rows.filter((r) => r.needsShift).map((r) => r.userId).sort()).toEqual([5, 6]);
    expect(plan.rows.some((r) => r.userId === BUDI)).toBe(false);
  });

  it('teguran otomatis: 1x per kartu, tidak untuk yang LIBUR', async () => {
    const { piket, db } = setup();
    await piket.checkin(5, 'PAGI', monday);
    await piket.checkin(6, 'PAGI', monday);
    await piket.checkin(6, 'LIBUR', monday); // 6 ternyata libur → kartunya terhapus
    const at = new Date(2026, 8, 21, 8, 50); // 20 menit lewat 08:30
    expect((await piket.sendAutoWarnings(at)).created).toBe(1);
    expect(db.warnings[0]).toMatchObject({ userId: 5, kind: 'AUTO', dateKey: '2026-09-21' });
    expect(db.warnings[0].message).toContain('Buka toko');
    expect((await piket.sendAutoWarnings(new Date(2026, 8, 21, 8, 55))).created).toBe(0); // idempoten
  });

  it('pengingat: hanya tugas milik sendiri yang batasnya dekat', async () => {
    const { piket } = setup();
    await piket.checkin(5, 'PAGI', monday); // Buka toko 08:30 milik user 5
    await piket.checkin(6, 'PAGI', monday); // kartu serupa milik user 6
    const up = await piket.myUpcoming(5, new Date(2026, 8, 21, 8, 10));
    expect(up).toMatchObject({ remindBeforeMinutes: 15, graceMinutes: 15 });
    expect(up.items.map((i: any) => [i.title, i.assigneeId])).toEqual([['Buka toko', 5]]);
    expect((await piket.myUpcoming(5, new Date(2026, 8, 21, 6, 0))).items).toHaveLength(0); // > 75 menit sebelum batas
    expect((await piket.myUpcoming(5, new Date(2026, 8, 21, 8, 50))).items).toHaveLength(0); // sudah lewat masa teguran
  });
});

describe('TaskPiketService — akses lewat PIN', () => {
  const setupPin = () => {
    const items: any[] = [{ id: 1, assigneeId: 5, status: 'TODO' }, { id: 2, assigneeId: 6, status: 'TODO' }];
    const designers: Record<number, any> = {
      1: { id: 1, name: 'Budi', pin: '1234', isActive: true, userId: 5 },
      2: { id: 2, name: 'Ndaru', pin: '9999', isActive: true, userId: null },
      3: { id: 3, name: 'Lama', pin: '1111', isActive: false, userId: 7 },
    };
    const db: any = {
      designer: { findUnique: jest.fn(async ({ where }: any) => designers[where.id] ?? null) },
      taskItem: {
        findUnique: jest.fn(async ({ where }: any) => items.find((i) => i.id === where.id) ?? null),
        update: jest.fn(async ({ where, data }: any) => Object.assign(items.find((i) => i.id === where.id), data)),
      },
    };
    return { items, piket: new TaskPiketService(db, new TaskBoardService(db)) };
  };

  it('PIN benar → akun terhubung; PIN salah / nonaktif / tak dikenal → ditolak', async () => {
    const { piket } = setupPin();
    await expect(piket.userForPin(1, '1234')).resolves.toEqual({ userId: 5, name: 'Budi' });
    await expect(piket.userForPin(1, '0000')).rejects.toThrow('PIN salah');
    await expect(piket.userForPin(3, '1111')).rejects.toThrow('PIN salah');
    await expect(piket.userForPin(99, '1234')).rejects.toThrow('PIN salah');
  });

  it('PIN belum terhubung ke akun → linked:false tanpa data piket', async () => {
    const { piket } = setupPin();
    await expect(piket.pinState(2, '9999')).resolves.toEqual({ linked: false, name: 'Ndaru' });
  });

  it('tandai Selesai hanya untuk tugas milik sendiri', async () => {
    const { piket, items } = setupPin();
    await expect(piket.completeOwnItem(5, 1)).resolves.toEqual({ id: 1, status: 'DONE' });
    expect(items[0]).toMatchObject({ status: 'DONE', completedById: 5 });
    await expect(piket.completeOwnItem(5, 2)).rejects.toThrow('tugas Anda sendiri');
    expect(items[1].status).toBe('TODO');
  });
});
