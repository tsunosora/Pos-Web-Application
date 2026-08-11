import api from "./client";

export interface StudioAiConfig {
    enabled: boolean;
    chatEnabled: boolean;
    baseUrl: string;
    model: string;
    apiKeySet: boolean;
    apiKeyMasked: string;
}

export interface StudioAiConfigUpdate {
    enabled?: boolean;
    chatEnabled?: boolean;
    baseUrl?: string;
    model?: string;
    apiKey?: string;      // hanya dikirim bila diganti
    clearApiKey?: boolean;
}

export const getStudioAiConfig = async (): Promise<StudioAiConfig> =>
    (await api.get("/studio-ai/config")).data;

export const updateStudioAiConfig = async (data: StudioAiConfigUpdate): Promise<StudioAiConfig> =>
    (await api.put("/studio-ai/config", data)).data;

export const testStudioAi = async (): Promise<{ ok: boolean; message: string }> =>
    (await api.post("/studio-ai/test")).data;

export const getStudioAiStatus = async (): Promise<{ enabled: boolean; chatEnabled: boolean; model: string }> =>
    (await api.get("/studio-ai/status")).data;

export interface AiProductCard {
    id: number;
    name: string;
    category: string;
    image: string | null;
    priceLabel: string;
}

export interface AiChatMessage { role: "user" | "assistant"; content: string; products?: AiProductCard[]; }

export const sendAiChat = async (
    message: string,
    history: AiChatMessage[],
): Promise<{ reply: string; refused: boolean; products: AiProductCard[] }> =>
    (await api.post("/studio-ai/chat", { message, history })).data;
