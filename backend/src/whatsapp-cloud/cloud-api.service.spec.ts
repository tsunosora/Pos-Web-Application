import { CloudApiService } from './cloud-api.service';

describe('CloudApiService', () => {
    let service: CloudApiService;
    let fetchMock: jest.Mock;

    const okResponse = (data: any) => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => data,
    });
    const errResponse = (status: number, data: any) => ({
        ok: false,
        status,
        statusText: 'Error',
        json: async () => data,
    });

    beforeEach(() => {
        process.env.WA_ACCESS_TOKEN = 'TESTTOKEN';
        process.env.WA_GRAPH_VERSION = 'v21.0';
        service = new CloudApiService();
        fetchMock = jest.fn();
        (global as any).fetch = fetchMock;
    });

    afterEach(() => {
        jest.restoreAllMocks();
        delete (global as any).fetch;
    });

    describe('sendText', () => {
        it('POST ke {phoneNumberId}/messages dgn Bearer token & body teks benar', async () => {
            fetchMock.mockResolvedValue(okResponse({ messages: [{ id: 'wamid.ABC' }] }));

            const res = await service.sendText('PNID123', '6281234567890', 'Halo');

            expect(res.waMessageId).toBe('wamid.ABC');
            expect(fetchMock).toHaveBeenCalledTimes(1);
            const [url, init] = fetchMock.mock.calls[0];
            expect(url).toBe('https://graph.facebook.com/v21.0/PNID123/messages');
            expect(init.method).toBe('POST');
            expect(init.headers.Authorization).toBe('Bearer TESTTOKEN');
            const body = JSON.parse(init.body);
            expect(body).toMatchObject({
                messaging_product: 'whatsapp',
                to: '6281234567890',
                type: 'text',
                text: { body: 'Halo' },
            });
        });

        it('melempar error terbaca saat respons 4xx', async () => {
            fetchMock.mockResolvedValue(
                errResponse(401, { error: { message: 'Invalid OAuth token', code: 190 } }),
            );
            await expect(service.sendText('PNID123', '628', 'x')).rejects.toThrow(/401.*Invalid OAuth token.*190/);
        });

        it('melempar bila token belum diset', async () => {
            process.env.WA_ACCESS_TOKEN = '';
            const s = new CloudApiService();
            await expect(s.sendText('PNID', '628', 'x')).rejects.toThrow(/WA_ACCESS_TOKEN/);
            expect(fetchMock).not.toHaveBeenCalled();
        });
    });

    describe('sendTemplate', () => {
        it('mengirim type=template dgn language & components', async () => {
            fetchMock.mockResolvedValue(okResponse({ messages: [{ id: 'wamid.TPL' }] }));

            const components = [{ type: 'body', parameters: [{ type: 'text', text: 'Budi' }] }];
            const res = await service.sendTemplate('PNID', '628', 'greeting', 'id', components);

            expect(res.waMessageId).toBe('wamid.TPL');
            const body = JSON.parse(fetchMock.mock.calls[0][1].body);
            expect(body.type).toBe('template');
            expect(body.template).toMatchObject({
                name: 'greeting',
                language: { code: 'id' },
                components,
            });
        });

        it('tanpa components tidak menyertakan field components', async () => {
            fetchMock.mockResolvedValue(okResponse({ messages: [{ id: 'x' }] }));
            await service.sendTemplate('PNID', '628', 'hello', 'id');
            const body = JSON.parse(fetchMock.mock.calls[0][1].body);
            expect(body.template.components).toBeUndefined();
        });
    });

    describe('getPhoneNumberInfo', () => {
        it('GET fields verified_name & display_phone_number', async () => {
            fetchMock.mockResolvedValue(
                okResponse({ verified_name: 'Toko PosPro', display_phone_number: '+62 812-3456-7890' }),
            );
            const info = await service.getPhoneNumberInfo('PNID');
            const [url, init] = fetchMock.mock.calls[0];
            expect(url).toContain('PNID?fields=verified_name,display_phone_number');
            expect(init.method).toBe('GET');
            expect(info.verifiedName).toBe('Toko PosPro');
            expect(info.displayNumber).toBe('+62 812-3456-7890');
        });
    });

    describe('enabled', () => {
        it('mengikuti WA_CLOUD_ENABLED', () => {
            process.env.WA_CLOUD_ENABLED = 'true';
            expect(new CloudApiService().enabled).toBe(true);
            process.env.WA_CLOUD_ENABLED = 'false';
            expect(new CloudApiService().enabled).toBe(false);
        });
    });
});
