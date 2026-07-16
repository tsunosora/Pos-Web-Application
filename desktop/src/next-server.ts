import { spawn, ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import path from "node:path";
import log from "electron-log";

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const port = (srv.address() as { port: number }).port;
      srv.close(() => resolve(port));
    });
  });
}

export interface NextHandle {
  url: string;
  proc: ChildProcess;
}

// frontendDir: path absolut ke folder "frontend" yang SUDAH di-`next build`.
export async function startNext(frontendDir: string): Promise<NextHandle> {
  const port = await freePort();
  const bin = path.join(
    frontendDir,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "next.cmd" : "next",
  );
  const proc = spawn(bin, ["start", "-p", String(port), "-H", "127.0.0.1"], {
    cwd: frontendDir,
    env: { ...process.env, NODE_ENV: "production" },
    stdio: "pipe",
    shell: process.platform === "win32", // .cmd butuh shell di Windows
  });
  proc.stdout?.on("data", (d) => log.info("[next]", d.toString().trim()));
  proc.stderr?.on("data", (d) => log.warn("[next]", d.toString().trim()));
  proc.on("error", (e) => log.error("[next] spawn error", e));

  const url = `http://127.0.0.1:${port}`;
  await waitForReady(url);
  return { url, proc };
}

async function waitForReady(url: string, timeoutMs = 30000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { method: "HEAD" });
      if (res.ok || res.status === 200 || res.status === 404) return;
    } catch {
      /* belum siap */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error("Next server tidak siap dalam 30s");
}
