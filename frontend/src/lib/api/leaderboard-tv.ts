import axios from 'axios';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export type TvPeriod = 'today' | 'week' | 'month';

export interface TvLeaderboard {
  period: { start: string; end: string };
  branchId: number | null;
  cs: {
    totals: Record<string, number>;
    metrics: Record<string, number>;
    leaderboard: any[];
    designCheckLeaderboard: any[];
    customMetricDefs?: any[];
  };
  designer: { leaderboard: any[]; totals: Record<string, number>; customMetricDefs?: any[] };
  operator: { leaderboard: any[]; customMetricDefs?: any[] };
  team: { leaderboard: any[]; totals: Record<string, number> };
  designOutput: { leaderboard: any[] };
  dailyTarget: {
    today: string;
    daysInMonth: number;
    branches: {
      branchId: number;
      branchName: string;
      dailyTarget: number;
      todayOmzet: number;
      pct: number;
      met: boolean;
      shortfall: number;
    }[];
  } | null;
}

export const verifyTvPin = async (pin: string): Promise<{ valid: boolean }> =>
  // Reuse PIN marketing yang sama (StoreSettings.marketingPin)
  (await axios.post(`${BASE}/crm/public/verify-pin`, { pin })).data;

export const getTvLeaderboard = async (
  pin: string,
  params: { period: TvPeriod; branchId?: number | null },
): Promise<TvLeaderboard> =>
  (await axios.post(`${BASE}/crm/public/leaderboard`, { pin, ...params })).data;
