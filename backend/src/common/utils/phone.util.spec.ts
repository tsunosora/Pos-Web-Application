import { toWaPhone, toLeadKey, samePhone } from './phone.util';

describe('phone.util', () => {
    describe('toWaPhone → format kanonik 62', () => {
        it('menerima 0-prefix, +62, dan spasi/strip', () => {
            expect(toWaPhone('0812-3456-7890')).toBe('6281234567890');
            expect(toWaPhone('+62 812 3456 7890')).toBe('6281234567890');
            expect(toWaPhone('81234567890')).toBe('6281234567890');
        });
        it('null utk input kosong/tak valid', () => {
            expect(toWaPhone('')).toBeNull();
            expect(toWaPhone(null)).toBeNull();
        });
    });

    describe('toLeadKey → tanpa 62 (samakan Lead.phoneNormalized)', () => {
        it('membuang prefix 62 dari berbagai format', () => {
            expect(toLeadKey('6281234567890')).toBe('81234567890');
            expect(toLeadKey('081234567890')).toBe('81234567890');
            expect(toLeadKey('+62 812-3456-7890')).toBe('81234567890');
        });
        it('null utk input kosong', () => {
            expect(toLeadKey('')).toBeNull();
            expect(toLeadKey(undefined)).toBeNull();
        });
    });

    it('samePhone menganggap format berbeda sebagai nomor sama', () => {
        expect(samePhone('081234567890', '+6281234567890')).toBe(true);
        expect(samePhone('081234567890', '089999999999')).toBe(false);
    });
});
