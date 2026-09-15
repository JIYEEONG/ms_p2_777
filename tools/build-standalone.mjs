import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const dist = path.join(root, "dist");
const output = path.join(root, "moov_무인차_플랫폼_앱_V2.1.html");

let html = await readFile(path.join(dist, "index.html"), "utf8");
const css = await readFile(path.join(dist, "styles.css"), "utf8");
let js = await readFile(path.join(dist, "app.js"), "utf8");

const assetMatches = [...`${html}\n${js}`.matchAll(/\.\/assets\/([A-Za-z0-9._-]+)/g)].map((match) => match[1]);
for (const filename of new Set(assetMatches)) {
  let sourceName = filename;
  if (filename.startsWith("course-") && filename.endsWith(".png")) {
    const jpgName = filename.replace(/\.png$/, ".jpg");
    try { await access(path.join(dist, "assets", jpgName)); sourceName = jpgName; } catch { /* keep PNG */ }
  }
  const filePath = path.join(dist, "assets", sourceName);
  const bytes = await readFile(filePath);
  const extension = path.extname(sourceName).slice(1).toLowerCase();
  const mime = extension === "jpg" || extension === "jpeg" ? "image/jpeg" : extension === "svg" ? "image/svg+xml" : "image/png";
  const dataUrl = `data:${mime};base64,${bytes.toString("base64")}`;
  js = js.replaceAll(`./assets/${filename}`, dataUrl);
  html = html.replaceAll(`./assets/${filename}`, dataUrl);
}

html = html
  .replace('<link rel="stylesheet" href="./styles.css" />', `<style>\n${css}\n</style>`)
  .replace('<script src="./app.js"></script>', `<script>\n${js}\n</script>`);

await writeFile(output, html, "utf8");
console.log(output);
