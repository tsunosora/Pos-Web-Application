import { matchesOn, periodKeyFor } from './recurrence.util';

const base = { startDate: null, endDate: null, isActive: true };

describe('matchesOn', () => {
  it('DAILY: cocok tiap hari', () => {
    expect(matchesOn({ ...base, frequency: 'DAILY' }, new Date('2026-08-03'))).toBe(true); // Senin
  });
  it('DAILY skipWeekends: lewati Sabtu/Minggu', () => {
    const s = { ...base, frequency: 'DAILY', skipWeekends: true };
    expect(matchesOn(s, new Date('2026-08-08'))).toBe(false); // Sabtu
    expect(matchesOn(s, new Date('2026-08-07'))).toBe(true); // Jumat
  });
  it('WEEKLY: hanya hari dalam daysOfWeek (ISO 1=Sen)', () => {
    const s = { ...base, frequency: 'WEEKLY', daysOfWeek: '1,3' }; // Sen & Rab
    expect(matchesOn(s, new Date('2026-08-03'))).toBe(true); // Senin
    expect(matchesOn(s, new Date('2026-08-04'))).toBe(false); // Selasa
    expect(matchesOn(s, new Date('2026-08-05'))).toBe(true); // Rabu
  });
  it('MONTHLY: cocok pada dayOfMonth, clamp akhir bulan pendek', () => {
    const s = { ...base, frequency: 'MONTHLY', dayOfMonth: 31 };
    expect(matchesOn(s, new Date('2026-02-28'))).toBe(true); // Feb clamp 31→28
    expect(matchesOn(s, new Date('2026-02-27'))).toBe(false);
    expect(matchesOn(s, new Date('2026-01-31'))).toBe(true);
  });
  it('hormati startDate/endDate & isActive', () => {
    expect(matchesOn({ ...base, frequency: 'DAILY', isActive: false }, new Date('2026-08-03'))).toBe(false);
    expect(matchesOn({ ...base, frequency: 'DAILY', startDate: new Date('2026-08-05') }, new Date('2026-08-03'))).toBe(false);
    expect(matchesOn({ ...base, frequency: 'DAILY', endDate: new Date('2026-08-01') }, new Date('2026-08-03'))).toBe(false);
  });
  it('ONCE: tidak pernah cocok via cron (dibuat langsung saat create)', () => {
    expect(matchesOn({ ...base, frequency: 'ONCE' }, new Date('2026-08-03'))).toBe(false);
  });
});

describe('periodKeyFor', () => {
  it('mengembalikan YYYY-MM-DD lokal', () => {
    expect(periodKeyFor(new Date(2026, 7, 3, 10, 0, 0))).toBe('2026-08-03');
  });
});
