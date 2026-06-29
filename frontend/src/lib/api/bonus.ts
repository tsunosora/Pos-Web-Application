import api from './client';

export type BonusRole = 'CS' | 'DESIGNER' | 'OPERATOR';

export interface BonusTarget {
    id: number;
    branchId: number;
    role: BonusRole;
    metric: string;            // OMZET | DESIGN_ACC | NOTA
    gajiPokok: number;
    bonusKualitas: number;
    bonusTim: number;
    bonusPribadi: number;
    targetTim: number;
    targetPribadi: number;
    periodTim: string;         // HARIAN | BULANAN
    periodPribadi: string;
}

export interface BonusEmployee {
    name: string;
    actual: number;
    personalAchieved: boolean;
    qualityEligible: boolean;
    forfeited: boolean;
    bonusTim: number;
    bonusPribadi: number;
    bonusKualitas: number;
    total: number;
    note: string | null;
}
export interface BonusRoleResult {
    role: BonusRole;
    metric: string;
    target: BonusTarget | null;
    teamActual: number;
    teamAchieved: boolean;
    targetTim: number;
    targetPribadi: number;
    employees: BonusEmployee[];
}
export interface BonusAchievement {
    branchId: number;
    month: string;
    roles: Record<BonusRole, BonusRoleResult>;
}

export const getBonusTargets = async (branchId?: number): Promise<BonusTarget[]> =>
    (await api.get('/bonus/targets', { params: branchId != null ? { branchId } : {} })).data;

export const upsertBonusTarget = async (data: Partial<BonusTarget> & { branchId: number; role: BonusRole }): Promise<BonusTarget> =>
    (await api.post('/bonus/targets', data)).data;

export const upsertBonusAdjustment = async (data: {
    branchId: number; role: BonusRole; employeeName: string; periodMonth: string;
    qualityEligible?: boolean; forfeited?: boolean; note?: string | null;
}): Promise<any> => (await api.post('/bonus/adjustments', data)).data;

export const getBonusAchievement = async (branchId: number, month: string): Promise<BonusAchievement> =>
    (await api.get('/bonus/achievement', { params: { branchId, month } })).data;
