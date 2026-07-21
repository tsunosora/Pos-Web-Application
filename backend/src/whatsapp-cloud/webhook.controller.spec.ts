import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { createHmac } from 'crypto';
import { WhatsappWebhookController } from './webhook.controller';

describe('WhatsappWebhookController', () => {
    let inbox: { ingestWebhook: jest.Mock };
    let controller: WhatsappWebhookController;

    beforeEach(() => {
        inbox = { ingestWebhook: jest.fn().mockResolvedValue(undefined) };
        controller = new WhatsappWebhookController(inbox as any);
        process.env.WA_VERIFY_TOKEN = 'VERIFY123';
        process.env.WA_APP_SECRET = 'SECRET123';
    });

    describe('verify (GET)', () => {
        it('mengembalikan challenge saat token cocok', () => {
            const res = controller.verify({
                'hub.mode': 'subscribe',
                'hub.verify_token': 'VERIFY123',
                'hub.challenge': 'CHAL42',
            });
            expect(res).toBe('CHAL42');
        });

        it('menolak (403) saat token salah', () => {
            expect(() =>
                controller.verify({ 'hub.mode': 'subscribe', 'hub.verify_token': 'salah', 'hub.challenge': 'x' }),
            ).toThrow(ForbiddenException);
        });
    });

    describe('receive (POST)', () => {
        const body = { entry: [] };
        const raw = Buffer.from(JSON.stringify(body));
        const sig = 'sha256=' + createHmac('sha256', 'SECRET123').update(raw).digest('hex');

        it('memproses & balas ok saat signature valid', async () => {
            const req: any = { rawBody: raw };
            const res = await controller.receive(req, sig, body);
            expect(res).toEqual({ ok: true });
            expect(inbox.ingestWebhook).toHaveBeenCalledWith(body);
        });

        it('menolak (401) saat signature tidak valid', async () => {
            const req: any = { rawBody: raw };
            await expect(controller.receive(req, 'sha256=ngawur', body)).rejects.toThrow(UnauthorizedException);
            expect(inbox.ingestWebhook).not.toHaveBeenCalled();
        });

        it('tanpa app secret (dev) tetap memproses', async () => {
            process.env.WA_APP_SECRET = '';
            const req: any = { rawBody: raw };
            const res = await controller.receive(req, undefined as any, body);
            expect(res).toEqual({ ok: true });
            expect(inbox.ingestWebhook).toHaveBeenCalled();
        });
    });
});
