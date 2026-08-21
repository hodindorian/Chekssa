import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { instances, envMock } = vi.hoisted(() => ({ instances: [], envMock: { is: { dev: false } } }));

vi.mock("./env.js", () => envMock);

class FakeBrowserWindow {
  constructor(opts) {
    this.opts = opts;
    this.bounds = { x: opts.x, y: opts.y, width: opts.width, height: opts.height };
    this.destroyed = false;
    this.listeners = {};
    this.webContentsListeners = {};
    this.webContents = {
      once: (event, cb) => {
        (this.webContentsListeners[event] ??= []).push(cb);
      },
      send: vi.fn(),
    };
    instances.push(this);
  }

  on(event, cb) {
    (this.listeners[event] ??= []).push(cb);
  }

  once(event, cb) {
    this.on(event, cb);
  }

  fireReadyToShow() {
    for (const cb of this.listeners["ready-to-show"] ?? []) cb();
  }

  fireDidFinishLoad() {
    for (const cb of this.webContentsListeners["did-finish-load"] ?? []) cb();
  }

  showInactive = vi.fn();
  setAlwaysOnTop = vi.fn();
  setVisibleOnAllWorkspaces = vi.fn();
  loadURL = vi.fn();
  setBounds = vi.fn((bounds) => {
    this.bounds = bounds;
  });

  isDestroyed() {
    return this.destroyed;
  }

  close() {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const cb of this.listeners.closed ?? []) cb();
  }
}

FakeBrowserWindow.fromWebContents = (webContents) => instances.find((win) => win.webContents === webContents) ?? null;

vi.mock("electron", () => ({
  BrowserWindow: FakeBrowserWindow,
  screen: {
    getCursorScreenPoint: () => ({ x: 0, y: 0 }),
    getDisplayNearestPoint: () => DISPLAY,
  },
}));
vi.mock("./store.js", () => ({
  store: {
    get: (key) => {
      if (key === "overlayPosition") return { xPct: 0.5, yPct: 0.25, widthPct: 0.2 };
      if (key === "overlayDurationMs") return 8000;
      return undefined;
    },
  },
}));
vi.mock("./localServer.js", () => ({ getLocalServerPort: () => 4321 }));

const DISPLAY = {
  workArea: { x: 0, y: 0, width: 1920, height: 1080 },
  workAreaSize: { width: 1920, height: 1080 },
};

const {
  getCompactWidth,
  computeDimensions,
  autoCloseDuration,
  boundsForDisplay,
  showBroadcast,
  closeOverlay,
  setOverlayExpanded,
} = await import("./overlayManager.js");

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

describe("computeDimensions", () => {
  it("derives height from width and aspect ratio when nothing needs clamping", () => {
    expect(computeDimensions(340, 16 / 9, DISPLAY)).toEqual({ width: 340, height: 340 / (16 / 9) });
  });

  it("falls back to 16:9 when given no/invalid aspect ratio", () => {
    expect(computeDimensions(340, 0, DISPLAY)).toEqual({ width: 340, height: 340 / (16 / 9) });
    expect(computeDimensions(340, undefined, DISPLAY)).toEqual({ width: 340, height: 340 / (16 / 9) });
  });

  it("shrinks width along with height for a tall image, instead of cropping it", () => {
    // A very tall image (ratio 0.05) at width 340 would need height 6800px,
    // way over the 70%-of-screen cap (756px here) - width must come down too
    // so the window's shape still matches the image exactly.
    const { width, height } = computeDimensions(340, 0.05, DISPLAY);
    expect(height).toBe(1080 * 0.7);
    expect(width).toBeCloseTo(height * 0.05, 5);
    expect(width).toBeLessThan(340);
  });

  it("grows width along with height for an ultra-wide image, instead of leaving it too short", () => {
    // A panorama (ratio 6) at width 340 would need height ~57px, under the
    // 90px floor - height must come up to the floor and width along with it.
    const { width, height } = computeDimensions(340, 6, DISPLAY);
    expect(height).toBe(90);
    expect(width).toBeCloseTo(90 * 6, 5);
    expect(width).toBeGreaterThan(340);
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

  it("treats a youtube/local-video clip with no start/end as zero-length", () => {
    expect(autoCloseDuration({ media: { kind: "local-video" } })).toBe(8000);
  });

  it("uses a flat fallback for tiktok (no known duration)", () => {
    expect(autoCloseDuration({ media: { kind: "tiktok" } })).toBe(10000 + 1500);
  });

  it("caps twitter duration at the video safety ceiling", () => {
    expect(autoCloseDuration({ media: { kind: "twitter", durationMs: 60000 } })).toBe(10000 + 1500);
  });

  it("uses the video safety ceiling for twitter when no duration is known", () => {
    expect(autoCloseDuration({ media: { kind: "twitter" } })).toBe(10000 + 1500);
  });
});

describe("overlay window lifecycle", () => {
  beforeEach(() => {
    instances.length = 0;
    vi.useFakeTimers();
  });

  afterEach(() => {
    let guard = 0;
    while (guard++ < 20) {
      const alive = instances.find((win) => !win.isDestroyed());
      if (!alive) break;
      alive.close();
    }
    vi.useRealTimers();
  });

  it("creates a window, loads the overlay page, and delivers the payload once ready", () => {
    showBroadcast({ media: { kind: "image", aspectRatio: 1 }, texts: [] });

    expect(instances).toHaveLength(1);
    const win = instances[0];
    expect(win.loadURL).toHaveBeenCalledWith(expect.stringContaining("http://127.0.0.1:4321/overlay.html"));

    win.fireReadyToShow();
    expect(win.showInactive).toHaveBeenCalled();

    win.fireDidFinishLoad();
    expect(win.webContents.send).toHaveBeenCalledWith("overlay:payload", expect.objectContaining({ texts: [] }));
  });

  it("loads from the Vite dev server URL when running in dev mode", () => {
    envMock.is.dev = true;
    process.env.ELECTRON_RENDERER_URL = "http://localhost:5173";
    try {
      showBroadcast({ media: { kind: "image" }, texts: [] });
      expect(instances[0].loadURL).toHaveBeenCalledWith("http://localhost:5173/overlay.html");
    } finally {
      envMock.is.dev = false;
      delete process.env.ELECTRON_RENDERER_URL;
    }
  });

  it("queues a second broadcast while one is active, then shows it once the first closes", () => {
    showBroadcast({ media: { kind: "image" }, texts: [] });
    showBroadcast({ media: { kind: "image" }, texts: [{ id: 1, content: "second" }] });

    expect(instances).toHaveLength(1);

    instances[0].close();

    expect(instances).toHaveLength(2);
    expect(instances[1].opts).toBeDefined();
  });

  it("closes the active overlay matching the given webContents, ignores an unrelated one", () => {
    showBroadcast({ media: { kind: "image" }, texts: [] });
    const win = instances[0];

    closeOverlay({ not: "a real webContents" });
    expect(win.isDestroyed()).toBe(false);

    closeOverlay(win.webContents);
    expect(win.isDestroyed()).toBe(true);
  });

  it("expands the overlay, then shrinks it back and reschedules auto-close", () => {
    showBroadcast({ media: { kind: "image" }, texts: [] });
    const win = instances[0];
    const compactWidth = win.bounds.width;

    setOverlayExpanded(win.webContents, true);
    expect(win.bounds.width).toBeGreaterThan(compactWidth);
    expect(win.webContents.send).toHaveBeenCalledWith("overlay:expanded-changed", true);

    setOverlayExpanded(win.webContents, false);
    expect(win.bounds.width).toBe(compactWidth);
    expect(win.webContents.send).toHaveBeenCalledWith("overlay:expanded-changed", false);

    vi.advanceTimersByTime(8000);
    expect(win.isDestroyed()).toBe(true);
  });

  it("auto-closes after the computed duration and advances the queue", () => {
    showBroadcast({ media: { kind: "image" }, texts: [] });
    const first = instances[0];
    first.fireDidFinishLoad();

    vi.advanceTimersByTime(8000);
    expect(first.isDestroyed()).toBe(true);
    expect(instances).toHaveLength(1);
  });

  it("ignores a stale closed event for a window that's already been superseded", () => {
    showBroadcast({ media: { kind: "image" }, texts: [] });
    const win = instances[0];
    const closedCallback = win.listeners.closed[0];

    closedCallback();
    expect(() => closedCallback()).not.toThrow();
  });

  it("skips re-closing a window that's already destroyed when its auto-close timer fires", () => {
    showBroadcast({ media: { kind: "image" }, texts: [] });
    const win = instances[0];
    win.fireDidFinishLoad();

    // Closed some other way (e.g. the close button) before the auto-close
    // timer got to it - the timer is still pending and must find out.
    win.close();
    expect(() => vi.advanceTimersByTime(8000)).not.toThrow();
  });

  it("closeOverlay and setOverlayExpanded are no-ops when nothing is showing", () => {
    expect(() => closeOverlay({})).not.toThrow();
    expect(() => setOverlayExpanded({}, true)).not.toThrow();
  });

  it("setOverlayExpanded is a no-op for a window that's already destroyed", () => {
    showBroadcast({ media: { kind: "image" }, texts: [] });
    const win = instances[0];
    win.destroyed = true;

    setOverlayExpanded(win.webContents, true);
    expect(win.setBounds).not.toHaveBeenCalled();

    // Undo the manual flag flip the way production code would: through the
    // real "closed" path, so activeEntry doesn't leak stale into later tests.
    win.destroyed = false;
    win.close();
  });
});
