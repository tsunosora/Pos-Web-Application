import log from "electron-log";
import { printEscpos } from "./printing";

// Print Relay Agent INTERNAL (versi TypeScript dari tools/print-bridge/agent.py).
//
// Membuat aplikasi desktop ini bertindak sebagai "pusat cetak" cabang: ia
// long-poll ke server PUSAT (bukan backend lokal) di /printer-relay/poll dengan
// header x-printer-token, lalu mencetak job yang dikirim device LAIN (browser/
// tablet) ke printer thermal yang tercolok ke PC ini — persis seperti agent.py,
// tapi bundel di dalam app (tak perlu jalankan Python terpisah).
//
// Catatan arsitektur: device kasir lain menembak server PUSAT, jadi antrean relay
// ada di pusat. Karena itu agen ini poll ke centralUrl, BUKAN backend lokal.

// Timeout long-poll harus > lama server menahan (~25s) + margin.
const POLL_TIMEOUT_MS = 35_000;
const ACK_TIMEOUT_MS = 15_000;
const RETRY_SLEEP_MS = 3_000;

// UA seperti browser: sebagian Cloudflare/WAF "Bot Fight Mode" memblokir default
// klien non-browser (403) sebelum request sampai ke backend.
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36";

interface RelayJob {
  jobId: string;
  dataBase64: string;
  createdAt?: number;
}

let running = false;
let stopped = false;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function pollOnce(base: string, token: string): Promise<RelayJob | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), POLL_TIMEOUT_MS);
  try {
    const res = await fetch(base + "/printer-relay/poll", {
      headers: { "x-printer-token": token, "user-agent": USER_AGENT },
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}`) as Error & { status?: number };
      err.status = res.status;
      throw err;
    }
    const data = (await res.json()) as { job?: RelayJob | null };
    return data?.job ?? null;
  } finally {
    clearTimeout(t);
  }
}

async function ack(
  base: string,
  token: string,
  jobId: string,
  ok: boolean,
  target = "",
  error = "",
): Promise<void> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ACK_TIMEOUT_MS);
  try {
    await fetch(base + "/printer-relay/ack", {
      method: "POST",
      headers: {
        "x-printer-token": token,
        "content-type": "application/json",
        "user-agent": USER_AGENT,
      },
      body: JSON.stringify({ jobId, ok, target, error }),
      signal: ctrl.signal,
    });
  } catch (e) {
    // ACK gagal bukan fatal — job berikutnya tetap jalan.
    log.warn(`[relay] ack gagal (job ${jobId.slice(0, 8)}):`, e);
  } finally {
    clearTimeout(t);
  }
}

async function loop(base: string, token: string): Promise<void> {
  log.info("[relay] agen relay aktif — melayani cetak device lain via", base);
  let warned401 = false;
  while (!stopped) {
    let job: RelayJob | null = null;
    try {
      job = await pollOnce(base, token);
      warned401 = false;
    } catch (e) {
      const err = e as Error & { status?: number };
      if (err.status === 401) {
        if (!warned401) {
          log.warn(
            "[relay] TOKEN DITOLAK pusat (401). Token printer salah / device " +
              "dinonaktifkan — perbarui printerRelayToken di pospro-config.json.",
          );
          warned401 = true;
        }
        await sleep(RETRY_SLEEP_MS);
        continue;
      }
      if (err.name === "AbortError") {
        // Long-poll melewati batas (server hang) — poll lagi.
        continue;
      }
      // Error jaringan / pusat sesaat tak terjangkau.
      await sleep(RETRY_SLEEP_MS);
      continue;
    }

    if (!job) continue; // timeout long-poll normal (tak ada job) → poll lagi

    const short = job.jobId.slice(0, 8);
    try {
      // Cetak via printer LOKAL PC ini (config dibaca dari printer-config.json).
      const res = await printEscpos({ bytesBase64: job.dataBase64 });
      if (res.ok) {
        log.info(`[relay] cetak OK job ${short} → ${res.target ?? "?"}`);
        await ack(base, token, job.jobId, true, res.target ?? "");
      } else {
        throw new Error(res.error || "cetak gagal");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log.error(`[relay] cetak GAGAL job ${short}:`, msg);
      await ack(base, token, job.jobId, false, "", msg);
    }
  }
  running = false;
  log.info("[relay] agen relay berhenti");
}

/** Nyalakan agen relay. No-op bila sudah jalan. */
export function startRelayAgent(opts: { url: string; token: string }): void {
  if (running) return;
  running = true;
  stopped = false;
  void loop(opts.url.replace(/\/+$/, ""), opts.token);
}

/** Hentikan agen relay (dipanggil saat shutdown). */
export function stopRelayAgent(): void {
  stopped = true;
}
