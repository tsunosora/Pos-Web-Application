import { BACKUP_GROUPS, RESTORE_ORDER } from './backup.service';

/**
 * Guard: setiap tabel yang terdaftar untuk di-backup HARUS punya posisi di
 * RESTORE_ORDER, kalau tidak data itu tak akan pernah dipulihkan saat restore.
 * Mencegah regresi "lupa daftarkan model baru" (mis. saat menambah tabel WA
 * broadcast/template di fase berikutnya).
 */
describe('backup registry integrity', () => {
    const allGroupTables = Object.values(BACKUP_GROUPS).flatMap((g) => g.tables as readonly string[]);

    it('semua tabel di BACKUP_GROUPS ada di RESTORE_ORDER', () => {
        const missing = allGroupTables.filter((t) => !RESTORE_ORDER.includes(t));
        expect(missing).toEqual([]);
    });

    it('tidak ada duplikat di RESTORE_ORDER', () => {
        const seen = new Set<string>();
        const dupes = RESTORE_ORDER.filter((t) => (seen.has(t) ? true : (seen.add(t), false)));
        expect(dupes).toEqual([]);
    });

    it('tabel WhatsApp CRM terdaftar di backup & restore', () => {
        const waTables = ['waChannel', 'waContact', 'waConversation', 'waMessage', 'waWebhookEvent'];
        for (const t of waTables) {
            expect(BACKUP_GROUPS.whatsapp.tables as readonly string[]).toContain(t);
            expect(RESTORE_ORDER).toContain(t);
        }
    });
});
