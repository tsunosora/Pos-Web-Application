import { spawn, ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import fs from "node:fs";
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

// frontendDir:
//  - Produksi (paket): root output "standalone" berisi server.js → dijalankan lewat
//    Electron sebagai Node (ELECTRON_RUN_AS_NODE) di port bebas.
//  - Dev: folder "frontend" repo (ada node_modules/.bin/next) → `next start`.
export async function startNext(frontendDir: string): Promise<NextHandle> {
  const port = await freePort();
  const serverJs = path.join(frontendDir, "server.js");
  const standalone = fs.existsSync(serverJs);

  let proc: ChildProcess;
  if (standalone) {
    proc = spawn(process.execPath, [serverJs], {
      cwd: frontendDir,
      env: {
        ...process.env,
        NODE_ENV: "production",
        PORT: String(port),
        HOSTNAME: "127.0.0.1",
        ELECTRON_RUN_AS_NODE: "1",
      },
      stdio: "pipe",
    });
  } else {
    const bin = path.join(
      frontendDir,
      "node_modules",
      ".bin",
      process.platform === "win32" ? "next.cmd" : "next",
    );
    proc = spawn(bin, ["start", "-p", String(port), "-H", "127.0.0.1"], {
      cwd: frontendDir,
      env: { ...process.env, NODE_ENV: "production" },
      stdio: "pipe",
      shell: process.platform === "win32",
    });
  }

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
      // Respons apa pun (200/307/404/…) berarti server sudah listening.
      await fetch(url, { method: "HEAD" });
      return;
    } catch {
      /* belum siap */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error("Next server tidak siap dalam 30s");
}
