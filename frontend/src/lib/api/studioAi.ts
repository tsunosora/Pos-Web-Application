import api from "./client";

export interface StudioAiConfig {
    enabled: boolean;
    baseUrl: string;
    model: string;
    apiKeySet: boolean;
    apiKeyMasked: string;
}

export interface StudioAiConfigUpdate {
    enabled?: boolean;
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
