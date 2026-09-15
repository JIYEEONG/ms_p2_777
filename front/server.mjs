import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { createServer } from "node:http";

const port = Number(process.env.PORT || 3000);
const root = process.cwd();
const publicDir = join(root, "public");
const fallbackFile = join(publicDir, "moov.html");

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
  const normalizedPath = normalize(requestedPath).replace(/^(\.\.[/\\])+/, "");
  const publicFile = join(publicDir, normalizedPath);

  if (requestedPath === "/" || requestedPath === "/index.html") {
    sendFile(res, fallbackFile);
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
