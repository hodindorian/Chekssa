import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Lives next to package.json (server/ip.txt), not inside src/ - keeps it out
// of the Dockerfile's `COPY src ./src` and easy to find either way the
// server is run (npm workspace script or the Docker image).
export const DEFAULT_IP_LOG_PATH = join(dirname(fileURLToPath(import.meta.url)), "../ip.txt");

// socket.io reports dual-stack IPv4 clients as "::ffff:1.2.3.4" and
// loopback as "::1" - normalize both so the file reads as plain IPs.
export function normalizeIp(rawIp) {
  const ip = String(rawIp || "").trim();
  if (ip === "::1") return "127.0.0.1";
  return ip.replace(/^::ffff:/, "");
}

// One line per known IP, "pseudo - ip" once a pseudo is known or just "ip"
// until then. Parsed back into ip -> pseudo|null so a later pseudo can
// upgrade an existing bare-IP line in place instead of duplicating it.
export function parseEntries(text) {
  const entries = new Map();
  for (const rawLine of String(text || "").split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const sepIndex = line.lastIndexOf(" - ");
    if (sepIndex === -1) {
      entries.set(line, null);
    } else {
      entries.set(line.slice(sepIndex + 3).trim(), line.slice(0, sepIndex).trim());
    }
  }
  return entries;
}

export function formatEntries(entries) {
  const lines = [...entries].map(([ip, pseudo]) => (pseudo ? `${pseudo} - ${ip}` : ip));
  return lines.length ? lines.join("\n") + "\n" : "";
}

function readEntries(filePath) {
  if (!existsSync(filePath)) return new Map();
  return parseEntries(readFileSync(filePath, "utf8"));
}

// New IP seen for the first time -> logged bare; already known (with or
// without a pseudo) -> left untouched, so this never creates duplicates.
export function recordConnection(rawIp, filePath = DEFAULT_IP_LOG_PATH) {
  const ip = normalizeIp(rawIp);
  if (!ip) return;
  const entries = readEntries(filePath);
  if (entries.has(ip)) return;
  entries.set(ip, null);
  writeFileSync(filePath, formatEntries(entries), "utf8");
}

// Links a pseudo to an IP, upgrading a bare line in place if that IP was
// already logged without one.
export function recordPseudo(rawIp, pseudo, filePath = DEFAULT_IP_LOG_PATH) {
  const ip = normalizeIp(rawIp);
  const name = String(pseudo || "").trim();
  if (!ip || !name) return;
  const entries = readEntries(filePath);
  if (entries.get(ip) === name) return;
  entries.set(ip, name);
  writeFileSync(filePath, formatEntries(entries), "utf8");
}
