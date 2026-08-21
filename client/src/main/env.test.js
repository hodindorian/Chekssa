import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("is.dev", () => {
  const original = process.env.ELECTRON_RENDERER_URL;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    if (original === undefined) delete process.env.ELECTRON_RENDERER_URL;
    else process.env.ELECTRON_RENDERER_URL = original;
  });

  it("is true when ELECTRON_RENDERER_URL is set", async () => {
    process.env.ELECTRON_RENDERER_URL = "http://localhost:5173";
    const { is } = await import("./env.js");
    expect(is.dev).toBe(true);
  });

  it("is false when ELECTRON_RENDERER_URL is unset", async () => {
    delete process.env.ELECTRON_RENDERER_URL;
    const { is } = await import("./env.js");
    expect(is.dev).toBe(false);
  });
});

describe("ICON_PATH", () => {
  it("points at build/icon.png relative to the client package", async () => {
    const { ICON_PATH } = await import("./env.js");
    expect(ICON_PATH.replace(/\\/g, "/")).toMatch(/\/client\/build\/icon\.png$/);
  });
});
