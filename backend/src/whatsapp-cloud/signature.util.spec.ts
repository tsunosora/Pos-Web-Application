import { createHmac } from 'crypto';
import { verifyMetaSignature } from './signature.util';

const sign = (body: string, secret: string) =>
    'sha256=' + createHmac('sha256', secret).update(body).digest('hex');

describe('verifyMetaSignature', () => {
    const secret = 'APP_SECRET_XYZ';
    const raw = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });

    it('menerima signature valid', () => {
        expect(verifyMetaSignature(raw, sign(raw, secret), secret)).toBe(true);
    });

    it('menerima raw body sebagai Buffer', () => {
        expect(verifyMetaSignature(Buffer.from(raw), sign(raw, secret), secret)).toBe(true);
    });

    it('menolak signature salah', () => {
        expect(verifyMetaSignature(raw, sign(raw, 'secret-lain'), secret)).toBe(false);
    });

    it('menolak body yang diubah', () => {
        const tampered = raw + ' ';
        expect(verifyMetaSignature(tampered, sign(raw, secret), secret)).toBe(false);
    });

    it('menolak bila argumen tidak lengkap', () => {
        expect(verifyMetaSignature(raw, undefined, secret)).toBe(false);
        expect(verifyMetaSignature(raw, sign(raw, secret), undefined)).toBe(false);
        expect(verifyMetaSignature(undefined, sign(raw, secret), secret)).toBe(false);
    });
});
