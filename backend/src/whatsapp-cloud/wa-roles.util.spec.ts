import { isDesignerRole, roleCanInbox } from './wa-roles.util';

describe('wa-roles.util', () => {
    describe('isDesignerRole', () => {
        it.each(['Desainer', 'Designer', 'design', 'Tim Desain Grafis'])('cocok: %s', (r) => {
            expect(isDesignerRole(r)).toBe(true);
        });
        it.each(['CS', 'Kasir', 'Operator', '', null])('tidak cocok: %s', (r) => {
            expect(isDesignerRole(r as any)).toBe(false);
        });
    });

    describe('roleCanInbox', () => {
        it.each([
            'Owner', 'Pemilik', 'Admin', 'Super Admin', 'Manajer', 'Supervisor',
            'CS', 'Customer Service', 'Layanan Pelanggan', 'Marketing', 'Tim Marketing',
            'Sales', 'Desainer', 'Designer', 'Operator', 'Operator Produksi',
        ])('boleh inbox: %s', (r) => {
            expect(roleCanInbox(r)).toBe(true);
        });

        it.each(['Kasir', 'Produksi', 'Gudang', '', null])('tidak boleh inbox: %s', (r) => {
            expect(roleCanInbox(r as any)).toBe(false);
        });
    });
});
