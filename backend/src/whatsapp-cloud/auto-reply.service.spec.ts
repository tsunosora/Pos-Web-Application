import { AutoReplyService } from './auto-reply.service';

function makePrisma(rules: any[] = [], recentHuman: any = null) {
    return {
        waContact: { update: jest.fn().mockResolvedValue({}) },
        waMessage: { findFirst: jest.fn().mockResolvedValue(recentHuman), create: jest.fn().mockResolvedValue({}) },
        waConversation: { update: jest.fn().mockResolvedValue({}) },
        waAutoReplyRule: { findMany: jest.fn().mockResolvedValue(rules) },
    };
}
const ctx = (over: any = {}) => ({
    channel: { id: 10, phoneNumberId: 'PN1' },
    contact: { id: 20, waId: '628a', optedOut: false },
    conversationId: 30,
    body: 'halo',
    isNew: true,
    ...over,
});

describe('AutoReplyService.createRule', () => {
    it('menolak KEYWORD tanpa keywords', () => {
        const svc = new AutoReplyService({} as any, {} as any);
        expect(() => svc.createRule({ trigger: 'KEYWORD', replyText: 'x' } as any)).toThrow(/kata kunci/);
    });
});

describe('AutoReplyService.handleInbound', () => {
    it('opt-out saat pesan "STOP" → set optedOut + kirim konfirmasi', async () => {
        const prisma = makePrisma();
        const cloud = { sendText: jest.fn().mockResolvedValue({ waMessageId: 'w1' }) };
        const svc = new AutoReplyService(prisma as any, cloud as any);

        await svc.handleInbound(ctx({ body: 'STOP' }));

        expect(prisma.waContact.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ optedOut: true }) }));
        expect(cloud.sendText).toHaveBeenCalled();
    });

    it('kontak sudah opt-out → tidak membalas', async () => {
        const prisma = makePrisma([{ trigger: 'GREETING', replyText: 'hai', isActive: true }]);
        const cloud = { sendText: jest.fn() };
        const svc = new AutoReplyService(prisma as any, cloud as any);

        await svc.handleInbound(ctx({ contact: { id: 20, waId: '628a', optedOut: true } }));

        expect(cloud.sendText).not.toHaveBeenCalled();
    });

    it('agen manusia baru membalas → skip auto-reply', async () => {
        const prisma = makePrisma([{ trigger: 'GREETING', replyText: 'hai' }], { id: 1 });
        const cloud = { sendText: jest.fn() };
        const svc = new AutoReplyService(prisma as any, cloud as any);

        await svc.handleInbound(ctx());

        expect(cloud.sendText).not.toHaveBeenCalled();
    });

    it('KEYWORD cocok → balas teksnya', async () => {
        const prisma = makePrisma([
            { trigger: 'KEYWORD', keywords: ['harga', 'biaya'], replyText: 'Harga mulai 50rb', priority: 5 },
            { trigger: 'GREETING', replyText: 'halo kak', priority: 1 },
        ]);
        const cloud = { sendText: jest.fn().mockResolvedValue({ waMessageId: 'w1' }) };
        const svc = new AutoReplyService(prisma as any, cloud as any);

        await svc.handleInbound(ctx({ body: 'berapa HARGA banner?', isNew: false }));

        expect(cloud.sendText).toHaveBeenCalledWith('PN1', '628a', 'Harga mulai 50rb');
        expect(prisma.waMessage.create).toHaveBeenCalled();
    });

    it('GREETING pada percakapan baru bila tak ada keyword cocok', async () => {
        const prisma = makePrisma([{ trigger: 'GREETING', replyText: 'Selamat datang!' }]);
        const cloud = { sendText: jest.fn().mockResolvedValue({ waMessageId: 'w1' }) };
        const svc = new AutoReplyService(prisma as any, cloud as any);

        await svc.handleInbound(ctx({ body: 'assalamualaikum', isNew: true }));

        expect(cloud.sendText).toHaveBeenCalledWith('PN1', '628a', 'Selamat datang!');
    });

    it('tanpa aturan → tidak melakukan apa-apa', async () => {
        const prisma = makePrisma([]);
        const cloud = { sendText: jest.fn() };
        const svc = new AutoReplyService(prisma as any, cloud as any);

        await svc.handleInbound(ctx({ isNew: false }));

        expect(cloud.sendText).not.toHaveBeenCalled();
    });
});
