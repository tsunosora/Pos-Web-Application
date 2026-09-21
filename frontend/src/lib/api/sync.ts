import api from './client';

// ---- PULL ----
export interface PullResult {
  serverTime: string;
  full: boolean;
  changes: Record<string, any[]>;
}

export async function pullSync(since?: string, entities?: string): Promise<PullResult> {
  const { data } = await api.get<PullResult>('/sync/pull', {
    params: { since: since || undefined, entities: entities || undefined },
  });
  return data;
}

// ---- PUSH ----
export interface PushOpInput {
  clientId: string;
  type: 'transaction.create' | 'cashflow.create';
  payload: any;
  branchId?: number | null; // cabang tempat op dibuat (bukan cabang aktif saat sinkron)
  occurredAt?: string; // waktu op dibuat (ISO)
}

export interface PushOpResult {
  clientId: string;
  status: 'applied' | 'duplicate' | 'error';
  serverId?: number;
  invoiceNumber?: string;
  message?: string;
}

export interface PushResult {
  serverTime: string;
  results: PushOpResult[];
}

export async function pushSync(ops: PushOpInput[]): Promise<PushResult> {
  const { data } = await api.post<PushResult>('/sync/push', { ops });
  return data;
}
