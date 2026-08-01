import { TaskBoardService } from './task-board.service';

/**
 * Unit test generateDue: memakai mock Prisma (tanpa DB) untuk membuktikan
 * materialisasi idempoten — panggilan kedua di periode yang sama tak membuat
 * kartu ganda (create melempar P2002 seperti constraint unik asli).
 */
function makeMockPrisma(schedules: any[]) {
  const created = new Set<string>(); // key: scheduleId|assigneeId|periodKey
  return {
    _created: created,
    taskSchedule: {
      findMany: jest.fn(async () => schedules.filter((s) => s.isActive && s.frequency !== 'ONCE')),
    },
    user: {
      findMany: jest.fn(async () => [{ id: 10 }, { id: 11 }]),
      findUnique: jest.fn(async ({ where }: any) => ({ id: where.id, branchId: 1 })),
    },
    taskItem: {
      create: jest.fn(async ({ data }: any) => {
        const key = `${data.scheduleId}|${data.assigneeId}|${data.periodKey}`;
        if (created.has(key)) {
          const e: any = new Error('Unique constraint failed');
          e.code = 'P2002';
          throw e;
        }
        created.add(key);
        return { id: created.size, ...data };
      }),
    },
  };
}

describe('TaskBoardService.generateDue (idempoten)', () => {
  const monday = new Date(2026, 7, 3); // Senin 3 Agustus 2026

  it('DAILY assignee spesifik: buat 1, ulang → 0', async () => {
    const mock = makeMockPrisma([
      { id: 1, title: 'Sapu', frequency: 'DAILY', priority: 'NORMAL', isActive: true, assigneeId: 5, targetRole: null, branchId: 1 },
    ]);
    const svc = new TaskBoardService(mock as any);

    const g1 = await svc.generateDue(monday);
    expect(g1.created).toBe(1);

    const g2 = await svc.generateDue(monday);
    expect(g2.created).toBe(0); // idempoten
    expect(mock.taskItem.create).toHaveBeenCalledTimes(2); // create dicoba 2x, 1 ditolak P2002
  });

  it('targetRole: 1 kartu per user role (2 user) → 2 kartu, ulang → 0', async () => {
    const mock = makeMockPrisma([
      { id: 2, title: 'Cek mesin', frequency: 'DAILY', priority: 'HIGH', isActive: true, assigneeId: null, targetRole: 'OPERATOR', branchId: 1 },
    ]);
    const svc = new TaskBoardService(mock as any);

    expect((await svc.generateDue(monday)).created).toBe(2);
    expect((await svc.generateDue(monday)).created).toBe(0);
  });

  it('WEEKLY tidak cocok di hari lain → 0 kartu', async () => {
    const mock = makeMockPrisma([
      { id: 3, title: 'Rekap', frequency: 'WEEKLY', daysOfWeek: '2', priority: 'NORMAL', isActive: true, assigneeId: 7, branchId: 1 },
    ]); // hanya Selasa
    const svc = new TaskBoardService(mock as any);
    expect((await svc.generateDue(monday)).created).toBe(0); // Senin ≠ Selasa
  });
});
