import { afterEach, describe, expect, it } from "vitest";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { formatEntries, normalizeIp, parseEntries, recordConnection, recordPseudo } from "./ipLog.js";

describe("normalizeIp", () => {
  it("maps IPv6 loopback to the plain IPv4 form", () => {
    expect(normalizeIp("::1")).toBe("127.0.0.1");
  });

  it("strips the IPv4-mapped IPv6 prefix", () => {
    expect(normalizeIp("::ffff:192.168.1.5")).toBe("192.168.1.5");
  });

  it("leaves a plain IPv4 address untouched", () => {
    expect(normalizeIp("203.0.113.4")).toBe("203.0.113.4");
  });
});

describe("parseEntries / formatEntries", () => {
  it("round-trips a mix of bare IPs and pseudo-linked entries", () => {
    const text = "DH - 1.2.3.4\n5.6.7.8\nX - 9.9.9.9\n";
    const entries = parseEntries(text);
    expect(entries).toEqual(
      new Map([
        ["1.2.3.4", "DH"],
        ["5.6.7.8", null],
        ["9.9.9.9", "X"],
      ])
    );
    expect(formatEntries(entries)).toBe(text);
  });

  it("ignores blank lines", () => {
    expect(parseEntries("1.2.3.4\n\n\nDH - 5.6.7.8\n").size).toBe(2);
  });

  it("formats an empty map as an empty string", () => {
    expect(formatEntries(new Map())).toBe("");
  });
});

describe("recordConnection / recordPseudo (file I/O)", () => {
  let filePath;

  afterEach(() => {
    rmSync(filePath, { force: true });
  });

  function tempPath() {
    filePath = join(tmpdir(), `chekssa-ip-log-unit-${Date.now()}-${Math.random()}.txt`);
    return filePath;
  }

  it("creates the file on the first connection", () => {
    const path = tempPath();
    expect(existsSync(path)).toBe(false);
    recordConnection("1.1.1.1", path);
    expect(readFileSync(path, "utf8")).toBe("1.1.1.1\n");
  });

  it("never duplicates an IP that's already logged", () => {
    const path = tempPath();
    recordConnection("1.1.1.1", path);
    recordConnection("1.1.1.1", path);
    recordConnection("1.1.1.1", path);
    expect(readFileSync(path, "utf8").trim().split("\n")).toEqual(["1.1.1.1"]);
  });

  it("upgrades a bare IP in place once a pseudo is known, without duplicating the line", () => {
    const path = tempPath();
    recordConnection("1.1.1.1", path);
    recordConnection("2.2.2.2", path);
    recordPseudo("1.1.1.1", "DH", path);
    expect(readFileSync(path, "utf8")).toBe("DH - 1.1.1.1\n2.2.2.2\n");
  });

  it("ignores an empty or missing pseudo", () => {
    const path = tempPath();
    recordConnection("1.1.1.1", path);
    recordPseudo("1.1.1.1", "", path);
    recordPseudo("1.1.1.1", undefined, path);
    expect(readFileSync(path, "utf8")).toBe("1.1.1.1\n");
  });

  it("does not rewrite the file when the pseudo is already up to date", () => {
    const path = tempPath();
    recordConnection("1.1.1.1", path);
    recordPseudo("1.1.1.1", "DH", path);
    const afterFirst = readFileSync(path, "utf8");
    recordPseudo("1.1.1.1", "DH", path);
    expect(readFileSync(path, "utf8")).toBe(afterFirst);
  });
});
