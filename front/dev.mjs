import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createConnection, createServer } from "node:net";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath, pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { createFrontendServer } from "./server.mjs";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));

function isListening(host, port) {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port });
    const finish = (listening) => { socket.destroy(); resolve(listening); };
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
    socket.setTimeout(1000, () => finish(true));
  });
}

function listen(server, port) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.removeListener("error", reject);
      resolve(server.address().port);
    });
  });
}

function closeServer(server) {
  return new Promise((resolve) => {
    if (!server?.listening) return resolve();
    server.close(resolve);
    server.closeAllConnections?.();
  });
}

export async function startDev({
  port = Number(process.env.PORT || 3000),
  backendPort = 8000,
  mapsOnly = false,
} = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error("PORT must be between 0 and 65535.");
  const python = process.env.MOOV_PYTHON || join(projectRoot, ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
  if (!process.env.MOOV_PYTHON && !existsSync(python)) {
    throw new Error("Python environment missing. At the project root, run: python -m venv .venv, then install backend/requirements.txt (see README.md).");
  }

  // Reserve the frontend port before starting a backend. Do not disturb an
  // already running frontend, backend, or unrelated service.
  const reservation = createServer((socket) => socket.destroy());
  let frontend;
  let backend;
  let stopping = false;
  let finish;
  const closed = new Promise((resolve) => { finish = resolve; });
  const signals = process.platform === "win32" ? ["SIGINT", "SIGTERM", "SIGBREAK"] : ["SIGINT", "SIGTERM"];
  const shutdown = () => { void stop(); };
  const emergencyCleanup = () => { if (backend && backend.exitCode === null) backend.kill(); };
  async function stop(code = 0) {
    if (stopping) return closed;
    stopping = true;
    const exited = backend?.pid && backend.exitCode === null && backend.signalCode === null
      ? new Promise((resolve) => backend.once("exit", resolve)) : Promise.resolve();
    backend?.kill();
    // A stuck Python shutdown must not leave a backend behind on Unix either.
    const force = setTimeout(() => backend?.kill("SIGKILL"), 3000);
    force.unref();
    await Promise.all([closeServer(reservation), closeServer(frontend), exited]);
    clearTimeout(force);
    for (const signal of signals) process.removeListener(signal, shutdown);
    process.removeListener("exit", emergencyCleanup);
    finish(code);
    return code;
  }

  try {
    // Windows can allow an IPv4-specific bind beside an existing wildcard
    // listener. Check both localhost addresses so a browser cannot reach an
    // older frontend over IPv6 while this launcher serves IPv4.
    if (port && (await Promise.all([isListening("127.0.0.1", port), isListening("::1", port)])).some(Boolean)) {
      throw Object.assign(new Error("Frontend is already listening."), { code: "EADDRINUSE" });
    }
    const actualPort = await listen(reservation, port);
    const appUrl = `http://localhost:${actualPort}`;
    for (const signal of signals) process.on(signal, shutdown);
    process.on("exit", emergencyCleanup);
    const args = ["-u", join(projectRoot, "tools/dev_backend.py"), "--port", String(backendPort), "--app-base", appUrl];
    if (mapsOnly) args.push("--maps-only");
    console.log(`[dev] Starting a fresh ${mapsOnly ? "maps/login" : "full"} backend...`);
    backend = spawn(python, args, {
      cwd: projectRoot, windowsHide: true, stdio: ["ignore", "pipe", "inherit"],
      env: { ...process.env, PYTHONUNBUFFERED: "1", PYTHONIOENCODING: "utf-8" },
    });
    let startupError;
    backend.once("error", (error) => { startupError = error; void stop(1); });
    backend.once("exit", (code, signal) => {
      if (!stopping) {
        startupError = new Error(`Backend stopped (${signal || code}). Check the backend error above. For maps/login only, use npm run dev:maps.`);
        console.error(`[dev] ${startupError.message}`);
        void stop(1);
      }
    });
    let backendUrl;
    const lines = createInterface({ input: backend.stdout });
    lines.on("line", (line) => {
      if (/^MOOV_BACKEND_URL=http:\/\/127\.0\.0\.1:\d+$/.test(line)) backendUrl = line.slice("MOOV_BACKEND_URL=".length);
      else console.log(line);
    });
    const deadline = Date.now() + 60000;
    let ready = false;
    while (!stopping && Date.now() < deadline) {
      if (backendUrl) {
        try {
          const response = await fetch(backendUrl + "/api/auth/config", { signal: AbortSignal.timeout(1000) });
          ready = response.ok && typeof (await response.json()).demoEnabled === "boolean";
        } catch { /* Python may still be importing the application. */ }
      }
      if (ready) break;
      await delay(150);
    }
    if (startupError) throw startupError;
    if (stopping) throw new Error("Startup cancelled.");
    if (!ready) throw new Error("Backend did not become ready within 60 seconds. Check the backend logs above.");
    await closeServer(reservation);
    if (stopping) throw new Error("Startup cancelled.");
    frontend = createFrontendServer(backendUrl);
    await listen(frontend, actualPort);
    console.log(`[dev] Backend: ${backendUrl}`);
    console.log(`[dev] MOOV is running at ${appUrl}`);
    console.log("[dev] Ctrl+C stops both servers. Run npm run dev again after changing backend code or .env.");
    return { appUrl, backendUrl, backend, closed, stop };
  } catch (error) {
    await stop(1);
    if (error.code === "EADDRINUSE") throw new Error(`Frontend port ${port} is already in use. Stop its existing terminal with Ctrl+C, then retry.`);
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const dev = await startDev({ mapsOnly: process.argv.includes("--maps-only") });
    process.exitCode = await dev.closed;
  } catch (error) {
    console.error(`[dev] ${error.message}`);
    process.exitCode = 1;
  }
}
