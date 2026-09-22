import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { createServer, request as httpRequest } from "node:http";

const port = Number(process.env.PORT || 3000);
const root = process.cwd();
const publicDir = join(root, "public");
const fallbackFile = join(publicDir, "moov.html");
const dashboardFile = join(publicDir, "dashboard", "index.html");
const backendUrl = process.env.MOOV_BACKEND_URL || "http://127.0.0.1:8000";

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function sendFile(res, filePath) {
  const type = contentTypes[extname(filePath).toLowerCase()] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": type });
  createReadStream(filePath).pipe(res);
}

createServer((req, res) => {
  const url = new URL(req.url || "/", `http://localhost:${port}`);
  const requestedPath = decodeURIComponent(url.pathname);
  if (requestedPath.startsWith("/api/outing/") || requestedPath.startsWith("/api/maps/") || requestedPath.startsWith("/api/auth/")) {
    const upstream = new URL(requestedPath + url.search, backendUrl);
    const proxy = httpRequest(upstream, { method: req.method, headers: { ...req.headers, host: upstream.host } }, (upstreamResponse) => {
      res.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
      upstreamResponse.pipe(res);
    });
    proxy.on("error", () => {
      if (!res.headersSent) res.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "backend unavailable", detail: "백엔드 서버 연결을 확인하세요 (기본 포트 8000)." }));
    });
    req.pipe(proxy);
    return;
  }
  const normalizedPath = normalize(requestedPath).replace(/^(\.\.[/\\])+/, "");
  const publicFile = join(publicDir, normalizedPath);

  if (requestedPath === "/" || requestedPath === "/index.html") {
    sendFile(res, fallbackFile);
    return;
  }

  if (requestedPath === "/dashboard" || requestedPath === "/dashboard/") {
    sendFile(res, dashboardFile);
    return;
  }

  if (publicFile.startsWith(publicDir) && existsSync(publicFile) && statSync(publicFile).isFile()) {
    sendFile(res, publicFile);
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Not found");
}).listen(port, () => {
  console.log(`MOOV is running at http://localhost:${port}`);
});
