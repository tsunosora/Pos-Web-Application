import { Injectable } from '@nestjs/common';

// Registry in-memory untuk print relay (long-poll). Menyimpan:
// - antrian job per cabang yang belum diambil agen,
// - "waiter" = request long-poll agen yang sedang ditahan menunggu job,
// - "ack" = request cetak kasir yang menunggu konfirmasi dari agen,
// - lastSeen per cabang untuk status online.
// Semua state hilang saat backend restart — itu tak apa (agen poll ulang otomatis,
// job cetak bersifat sekali-jalan; lastSeen dipersist ringan ke DB di service).

export interface RelayJob {
    jobId: string;
    dataBase64: string;
    createdAt: number;
}

export interface AckResult {
    ok: boolean;
    error?: string;
    target?: string;
}

interface JobWaiter {
    resolve: (job: RelayJob | null) => void;
    timer: NodeJS.Timeout;
}

interface AckWaiter {
    resolve: (r: AckResult) => void;
    timer: NodeJS.Timeout;
}

// Dianggap online bila poll terakhir < 35 detik lalu (agen hold ~25s + margin).
const ONLINE_WINDOW_MS = 35_000;

@Injectable()
export class PrinterRelayRegistry {
    private queues = new Map<number, RelayJob[]>();
    private waiters = new Map<number, JobWaiter[]>();
    private acks = new Map<string, AckWaiter>();
    private lastSeen = new Map<number, number>();

    markSeen(branchId: number): void {
        this.lastSeen.set(branchId, Date.now());
    }

    lastSeenAt(branchId: number): number | null {
        return this.lastSeen.get(branchId) ?? null;
    }

    isOnline(branchId: number): boolean {
        const list = this.waiters.get(branchId);
        if (list && list.length > 0) return true;
        const t = this.lastSeen.get(branchId);
        return t != null && Date.now() - t < ONLINE_WINDOW_MS;
    }

    /**
     * Long-poll agen. Kalau ada job antri → langsung kembalikan. Kalau tidak →
     * tahan sampai ada job masuk atau timeout (kembalikan null).
     */
    waitForJob(branchId: number, timeoutMs: number): Promise<RelayJob | null> {
        this.markSeen(branchId);
        const q = this.queues.get(branchId);
        if (q && q.length > 0) {
            const job = q.shift()!;
            if (q.length === 0) this.queues.delete(branchId);
            return Promise.resolve(job);
        }
        return new Promise((resolve) => {
            const waiter: JobWaiter = {
                resolve,
                timer: setTimeout(() => {
                    this.removeWaiter(branchId, waiter);
                    resolve(null);
                }, timeoutMs),
            };
            const list = this.waiters.get(branchId) ?? [];
            list.push(waiter);
            this.waiters.set(branchId, list);
        });
    }

    private removeWaiter(branchId: number, waiter: JobWaiter): void {
        const list = this.waiters.get(branchId);
        if (!list) return;
        const i = list.indexOf(waiter);
        if (i >= 0) list.splice(i, 1);
        if (list.length === 0) this.waiters.delete(branchId);
    }

    /**
     * Kirim job dari kasir: serahkan ke agen yang sedang menunggu, atau antrikan.
     * Return false kalau cabang tak punya agen online (job tak dititipkan).
     */
    submitJob(branchId: number, job: RelayJob): boolean {
        if (!this.isOnline(branchId)) return false;
        const list = this.waiters.get(branchId);
        if (list && list.length > 0) {
            const waiter = list.shift()!;
            if (list.length === 0) this.waiters.delete(branchId);
            clearTimeout(waiter.timer);
            waiter.resolve(job);
        } else {
            const q = this.queues.get(branchId) ?? [];
            q.push(job);
            this.queues.set(branchId, q);
        }
        return true;
    }

    /** Daftarkan penunggu ack SEBELUM submit (hindari balapan ack datang duluan). */
    waitForAck(jobId: string, timeoutMs: number): Promise<AckResult> {
        return new Promise((resolve) => {
            const timer = setTimeout(() => {
                this.acks.delete(jobId);
                resolve({ ok: false, error: 'Timeout: agen printer tidak merespons.' });
            }, timeoutMs);
            this.acks.set(jobId, { resolve, timer });
        });
    }

    cancelAck(jobId: string): void {
        const w = this.acks.get(jobId);
        if (!w) return;
        clearTimeout(w.timer);
        this.acks.delete(jobId);
    }

    resolveAck(jobId: string, result: AckResult): void {
        const w = this.acks.get(jobId);
        if (!w) return;
        clearTimeout(w.timer);
        this.acks.delete(jobId);
        w.resolve(result);
    }
}
