import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sharpInstance = {
  metadata: vi.fn(),
  resize: vi.fn(),
  jpeg: vi.fn(),
  toBuffer: vi.fn(),
};
sharpInstance.resize.mockReturnValue(sharpInstance);
sharpInstance.jpeg.mockReturnValue(sharpInstance);

vi.mock("sharp", () => ({ default: vi.fn(() => sharpInstance) }));

const { buildImageMedia, buildLocalVideoMedia, CLIP_SECONDS } = await import("./media.js");

function fakeResponse({ ok = true, status = 200, buffer = Buffer.from("data"), contentType = "" } = {}) {
  return {
    ok,
    status,
    arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    headers: { get: (name) => (name.toLowerCase() === "content-type" ? contentType : null) },
  };
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
  sharpInstance.metadata.mockReset();
  sharpInstance.toBuffer.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("buildImageMedia", () => {
  it("keeps a GIF as-is (base64, animated) instead of recompressing it", async () => {
    const gifBytes = Buffer.from("gif-bytes");
    fetch.mockResolvedValueOnce(fakeResponse({ buffer: gifBytes }));
    sharpInstance.metadata.mockResolvedValueOnce({ width: 100, height: 50 });

    const media = await buildImageMedia("https://cdn/a.gif", "image/gif");
    expect(media).toEqual({
      kind: "image",
      dataUrl: `data:image/gif;base64,${gifBytes.toString("base64")}`,
      aspectRatio: 2,
      isAnimated: true,
      durationMs: 10000,
    });
  });

  it("rejects a GIF over the size limit without downloading further", async () => {
    const bigGif = Buffer.alloc(9 * 1024 * 1024);
    fetch.mockResolvedValueOnce(fakeResponse({ buffer: bigGif }));
    await expect(buildImageMedia("https://cdn/a.gif", "image/gif")).rejects.toThrow(/trop volumineux/);
  });

  it("recompresses a static image to JPEG and reports its aspect ratio", async () => {
    fetch.mockResolvedValueOnce(fakeResponse({ buffer: Buffer.from("png-bytes"), contentType: "image/png" }));
    const jpegBytes = Buffer.from("jpeg-out");
    sharpInstance.toBuffer.mockResolvedValueOnce({ data: jpegBytes, info: { width: 300, height: 200 } });

    const media = await buildImageMedia("https://cdn/a.png", "image/png");
    expect(media).toEqual({
      kind: "image",
      dataUrl: `data:image/jpeg;base64,${jpegBytes.toString("base64")}`,
      aspectRatio: 1.5,
      isAnimated: false,
      durationMs: 10000,
    });
  });

  it("throws when the download itself fails", async () => {
    fetch.mockResolvedValueOnce(fakeResponse({ ok: false, status: 403 }));
    await expect(buildImageMedia("https://cdn/a.png", "image/png")).rejects.toThrow("403");
  });
});

describe("buildLocalVideoMedia", () => {
  it("builds a clip of CLIP_SECONDS starting from the given timestamp", async () => {
    fetch.mockResolvedValueOnce(fakeResponse({ buffer: Buffer.from("vid"), contentType: "video/mp4" }));
    const media = await buildLocalVideoMedia("https://cdn/a.mp4", 5);
    expect(media).toMatchObject({ kind: "local-video", start: 5, end: 5 + CLIP_SECONDS, aspectRatio: 16 / 9 });
  });

  it("floors a fractional/negative start to a safe non-negative integer", async () => {
    fetch.mockResolvedValueOnce(fakeResponse({ buffer: Buffer.from("vid"), contentType: "video/mp4" }));
    const media = await buildLocalVideoMedia("https://cdn/a.mp4", -3.7);
    expect(media.start).toBe(0);
  });

  it("rejects a video over the size limit", async () => {
    const bigVideo = Buffer.alloc(41 * 1024 * 1024);
    fetch.mockResolvedValueOnce(fakeResponse({ buffer: bigVideo }));
    await expect(buildLocalVideoMedia("https://cdn/a.mp4")).rejects.toThrow(/trop volumineuse/);
  });
});
