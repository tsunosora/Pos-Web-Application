export type Frequency = 'ONCE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';

export interface RecurrenceRule {
  frequency: Frequency | string;
  daysOfWeek?: string | null; // CSV ISO "1,3,5" (1=Senin .. 7=Minggu)
  dayOfMonth?: number | null; // 1-31
  skipWeekends?: boolean | null;
  startDate?: Date | null;
  endDate?: Date | null;
  isActive?: boolean | null;
}

/** ISO day: 1=Senin .. 7=Minggu (JS getDay(): 0=Minggu..6=Sabtu). */
function isoDay(d: Date): number {
  const js = d.getDay();
  return js === 0 ? 7 : js;
}

/** Batas awal-hari lokal untuk perbandingan tanggal (abaikan jam). */
function atStartOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function periodKeyFor(d: Date): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function matchesOn(rule: RecurrenceRule, date: Date): boolean {
  if (rule.isActive === false) return false;
  if (rule.frequency === 'ONCE') return false; // ONCE dibuat langsung, bukan via cron

  const today = atStartOfDay(date);
  if (rule.startDate && today < atStartOfDay(rule.startDate)) return false;
  if (rule.endDate && today > atStartOfDay(rule.endDate)) return false;

  const iso = isoDay(today);

  if (rule.frequency === 'DAILY') {
    if (rule.skipWeekends && (iso === 6 || iso === 7)) return false;
    return true;
  }

  if (rule.frequency === 'WEEKLY') {
    const days = (rule.daysOfWeek || '')
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => n >= 1 && n <= 7);
    return days.includes(iso);
  }

  if (rule.frequency === 'MONTHLY') {
    const want = rule.dayOfMonth ?? 1;
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const target = Math.min(want, lastDay); // clamp (mis. 31 → 28/30)
    return today.getDate() === target;
  }

  return false;
}
