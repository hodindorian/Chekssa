import http from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";

// YouTube's embedded player refuses to load ("Erreur 153 / configuration
// error") when the page embedding it has no proper http(s) origin - which is
// exactly what happens when Electron loads the packaged app via file://.
// Serving the built renderer over http://127.0.0.1 instead gives it a real
// origin/referrer, the same way it already works in dev (Vite's localhost
// server). Bound to loopback only, so it's never reachable from the network.

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

let server = null;
let port = 0;

export function startLocalServer(rootDir) {
  if (server) return Promise.resolve(port);
  return new Promise((resolve, reject) => {
    server = http.createServer((req, res) => handleRequest(req, res, rootDir));
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      port = server.address().port;
      resolve(port);
    });
  });
}

export function getLocalServerPort() {
  return port;
}

async function handleRequest(req, res, rootDir) {
  try {
    const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    const relativePath = normalize(urlPath).replace(/^([.]{2}[/\\])+/, "");
    const filePath = join(rootDir, relativePath);
    if (filePath !== rootDir && !filePath.startsWith(rootDir + sep)) {
      res.writeHead(403).end();
      return;
    }

    const info = await stat(filePath).catch(() => null);
    if (!info || !info.isFile()) {
      res.writeHead(404).end();
      return;
    }

    res.writeHead(200, { "Content-Type": MIME_TYPES[extname(filePath)] || "application/octet-stream" });
    createReadStream(filePath).pipe(res);
  } catch {
    if (!res.headersSent) res.writeHead(500);
    res.end();
  }
}
