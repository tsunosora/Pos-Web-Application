import api from "./client";
import { getActiveBranchId } from "@/store/branch-store";

export interface StudioAiConfig {
    enabled: boolean;
    chatEnabled: boolean;
    aiName: string;
    aiGreeting: string;
    aiAvatar: string;
    baseUrl: string;
    model: string;
    apiKeySet: boolean;
    apiKeyMasked: string;
}

export interface StudioAiConfigUpdate {
    enabled?: boolean;
    chatEnabled?: boolean;
    aiName?: string;
    aiGreeting?: string;
    aiAvatar?: string;
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

export const getStudioAiStatus = async (): Promise<{ enabled: boolean; chatEnabled: boolean; model: string; aiName: string; aiGreeting: string; aiAvatar: string }> =>
    (await api.get("/studio-ai/status")).data;

export interface AiProductCard {
    id: number;
    name: string;
    category: string;
    image: string | null;
    priceLabel: string;
}

export interface AiChatMessage { role: "user" | "assistant"; content: string; products?: AiProductCard[]; streaming?: boolean; }

export const sendAiChat = async (
    message: string,
    history: AiChatMessage[],
): Promise<{ reply: string; refused: boolean; products: AiProductCard[] }> =>
    (await api.post("/studio-ai/chat", { message, history })).data;

export interface AiStreamHandlers {
    onToken: (delta: string) => void;
    onDone: (data: { refused: boolean; products: AiProductCard[] }) => void;
    onError: (message: string) => void;
    signal?: AbortSignal;
}

/**
 * Versi STREAMING dari sendAiChat: token AI tiba bertahap (SSE) → efek "mengetik".
 * Pakai fetch mentah (axios tak bisa baca stream di browser). Header auth & cabang
 * disamakan dengan interceptor axios (client.ts).
 */
export async function streamAiChat(
    message: string,
    history: AiChatMessage[],
    { onToken, onDone, onError, signal }: AiStreamHandlers,
): Promise<void> {
    const base = api.defaults.baseURL || "";
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (typeof window !== "undefined") {
        const token = localStorage.getItem("token") || sessionStorage.getItem("token");
        if (token) headers.Authorization = `Bearer ${token}`;
    }
    try {
        const b = getActiveBranchId();
        if (b != null) headers["X-Branch-Id"] = String(b);
    } catch { /* store belum hydrate */ }

    let res: Response;
    try {
        res = await fetch(`${base}/studio-ai/chat/stream`, {
            method: "POST",
            headers,
            body: JSON.stringify({ message, history }),
            signal,
        });
    } catch (e: any) {
        onError(e?.name === "AbortError" ? "" : e?.message || "Gagal menghubungi asisten.");
        return;
    }
    if (!res.ok || !res.body) {
        let msg = `Gagal menghubungi asisten (${res.status}).`;
        try { const j = await res.json(); if (j?.message) msg = Array.isArray(j.message) ? j.message.join(", ") : j.message; } catch { /* non-json */ }
        onError(msg);
        return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let done: { refused: boolean; products: AiProductCard[] } | null = null;
    try {
        while (true) {
            const { value, done: finished } = await reader.read();
            if (finished) break;
            buffer += decoder.decode(value, { stream: true });
            let sep: number;
            // Frame SSE dipisah baris kosong (\n\n).
            while ((sep = buffer.indexOf("\n\n")) >= 0) {
                const frame = buffer.slice(0, sep);
                buffer = buffer.slice(sep + 2);
                let event = "message";
                let dataStr = "";
                for (const ln of frame.split("\n")) {
                    if (ln.startsWith("event:")) event = ln.slice(6).trim();
                    else if (ln.startsWith("data:")) dataStr += ln.slice(5).replace(/^ /, "");
                }
                if (!dataStr) continue;
                let data: any;
                try { data = JSON.parse(dataStr); } catch { data = dataStr; }
                if (event === "token") onToken(typeof data === "string" ? data : String(data));
                else if (event === "done") done = data;
                else if (event === "error") { onError(data?.message || "Terjadi kesalahan pada asisten."); return; }
            }
        }
    } catch (e: any) {
        if (e?.name !== "AbortError") { onError(e?.message || "Koneksi terputus."); return; }
    }
    onDone(done || { refused: false, products: [] });
}
