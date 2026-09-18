import { pinMatches } from './staff-pin.service';

describe('pinMatches', () => {
    it('cocok dengan salah satu PIN milik orang itu', () => {
        expect(pinMatches(['8241', '7390'], '7390')).toBe(true);
    });

    it('PIN salah ditolak', () => {
        expect(pinMatches(['8241'], '1111')).toBe(false);
    });

    it('spasi di ujung diabaikan (sering ikut saat di-paste)', () => {
        expect(pinMatches(['8241'], ' 8241 ')).toBe(true);
    });

    it('PIN kosong selalu ditolak, walau ada PIN kosong tersimpan', () => {
        expect(pinMatches([''], '')).toBe(false);
        expect(pinMatches(['8241'], '')).toBe(false);
        expect(pinMatches(['8241'], '   ')).toBe(false);
    });

    it('orang tanpa PIN sama sekali selalu ditolak', () => {
        expect(pinMatches([], '8241')).toBe(false);
    });

    it('tidak cocok sebagian — panjang harus sama persis', () => {
        expect(pinMatches(['8241'], '824')).toBe(false);
        expect(pinMatches(['8241'], '82410')).toBe(false);
    });
});
