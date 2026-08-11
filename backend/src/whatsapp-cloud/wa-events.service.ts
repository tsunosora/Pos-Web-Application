import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';

export interface WaEvent {
    type: 'message' | 'conversation';
    conversationId?: number;
    branchId?: number | null;
    ts: number;
}

/**
 * Event bus in-memory untuk push real-time inbox WA (SSE) — menggantikan polling
 * agresif. Backend fork 1 instance → Subject cukup (tak perlu Redis pub/sub).
 * Payload SENGAJA ringan (hanya conversationId): datanya tetap diambil lewat
 * endpoint ber-otorisasi, event hanya pemicu refetch.
 */
@Injectable()
export class WaEventsService {
    private readonly subject = new Subject<WaEvent>();

    stream() {
        return this.subject.asObservable();
    }

    emitMessage(conversationId: number, branchId?: number | null) {
        this.subject.next({ type: 'message', conversationId, branchId, ts: Date.now() });
    }

    emitConversation(branchId?: number | null) {
        this.subject.next({ type: 'conversation', branchId, ts: Date.now() });
    }
}
