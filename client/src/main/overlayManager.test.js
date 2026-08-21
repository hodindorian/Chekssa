import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({ BrowserWindow: class {}, screen: {} }));
vi.mock("./store.js", () => ({
  store: {
    get: (key) => {
      if (key === "overlayPosition") return { xPct: 0.5, yPct: 0.25, widthPct: 0.2 };
      if (key === "overlayDurationMs") return 8000;
      return undefined;
    },
  },
}));
vi.mock("./localServer.js", () => ({ getLocalServerPort: () => 0 }));

const { getCompactWidth, computeHeight, autoCloseDuration, boundsForDisplay } = await import("./overlayManager.js");

const DISPLAY = {
  workArea: { x: 0, y: 0, width: 1920, height: 1080 },
  workAreaSize: { width: 1920, height: 1080 },
};

describe("getCompactWidth", () => {
  it("scales with the display width and store's widthPct", () => {
    expect(getCompactWidth(DISPLAY)).toBe(Math.round(1920 * 0.2));
  });

  it("clamps to the minimum width on a tiny display", () => {
    const tiny = { workArea: {}, workAreaSize: { width: 200, height: 200 } };
    expect(getCompactWidth(tiny)).toBe(260);
  });

  it("clamps to the maximum width on a huge display", () => {
    const huge = { workArea: {}, workAreaSize: { width: 100000, height: 5000 } };
    expect(getCompactWidth(huge)).toBe(700);
  });
});

describe("computeHeight", () => {
  it("derives height from width and aspect ratio, plus the header allowance", () => {
    expect(computeHeight(340, 16 / 9, DISPLAY)).toBeCloseTo(340 / (16 / 9) + 56, 5);
  });

  it("falls back to 16:9 when given no/invalid aspect ratio", () => {
    expect(computeHeight(340, 0, DISPLAY)).toBeCloseTo(340 / (16 / 9) + 56, 5);
    expect(computeHeight(340, undefined, DISPLAY)).toBeCloseTo(340 / (16 / 9) + 56, 5);
  });

  it("caps height at 70% of the display's usable height", () => {
    expect(computeHeight(340, 0.05, DISPLAY)).toBe(1080 * 0.7);
  });
});

describe("boundsForDisplay", () => {
  it("places the box at the stored fractional position", () => {
    const bounds = boundsForDisplay(DISPLAY, 300, 200);
    expect(bounds).toEqual({ x: Math.round(0.5 * 1920), y: Math.round(0.25 * 1080), width: 300, height: 200 });
  });

  it("clamps so the box never spills off the right/bottom edge", () => {
    const bounds = boundsForDisplay(DISPLAY, 400, 400);
    expect(bounds.x).toBeLessThanOrEqual(1920 - 400);
    expect(bounds.y).toBeLessThanOrEqual(1080 - 400);
  });
});

describe("autoCloseDuration", () => {
  it("falls back to the stored default duration for a plain image with no explicit duration", () => {
    expect(autoCloseDuration({ media: { kind: "image" } })).toBe(8000);
  });

  it("uses the image's own duration when longer than the default, capped at 10s", () => {
    expect(autoCloseDuration({ media: { kind: "image", durationMs: 15000 } })).toBe(10000);
    expect(autoCloseDuration({ media: { kind: "image", durationMs: 3000 } })).toBe(3000);
  });

  it("covers a youtube/local-video clip's full length plus a trailing buffer", () => {
    expect(autoCloseDuration({ media: { kind: "youtube", start: 10, end: 20 } })).toBe(10000 + 1500);
  });

  it("uses a flat fallback for tiktok (no known duration)", () => {
    expect(autoCloseDuration({ media: { kind: "tiktok" } })).toBe(10000 + 1500);
  });

  it("caps twitter duration at the video safety ceiling", () => {
    expect(autoCloseDuration({ media: { kind: "twitter", durationMs: 60000 } })).toBe(10000 + 1500);
  });
});
