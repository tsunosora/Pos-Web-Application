import { PrinterRelayRegistry } from './printer-relay.registry';

describe('PrinterRelayRegistry', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('job yang ack-nya habis waktu dibuang dari antrean (tak tercetak belakangan)', async () => {
        const reg = new PrinterRelayRegistry();
        reg.markSeen(1); // agen dianggap online, tapi sedang tidak long-poll → job diantrikan
        const ack = reg.waitForAck('job-1', 15_000);
        expect(reg.submitJob(1, { jobId: 'job-1', dataBase64: 'eA==', createdAt: Date.now() })).toBe(true);
        jest.advanceTimersByTime(15_001);
        await expect(ack).resolves.toMatchObject({ ok: false });
        // Agen hidup lagi & long-poll: tidak ada job basi.
        const p = reg.waitForJob(1, 1_000);
        jest.advanceTimersByTime(1_001);
        await expect(p).resolves.toBeNull();
    });
});
