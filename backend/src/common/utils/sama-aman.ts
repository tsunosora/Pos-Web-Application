import { createHash, timingSafeEqual } from 'crypto';

/**
 * Bandingkan dua rahasia pendek (PIN) dalam waktu tetap. `===` biasa berhenti di karakter
 * pertama yang beda — selisih waktunya bisa dipakai menebak PIN digit demi digit.
 * Keduanya di-hash dulu supaya panjang berbeda pun dibandingkan dalam waktu yang sama.
 */
export function samaAman(a: unknown, b: unknown): boolean {
    if (a == null || b == null) return false;
    const ha = createHash('sha256').update(String(a)).digest();
    const hb = createHash('sha256').update(String(b)).digest();
    return timingSafeEqual(ha, hb);
}
