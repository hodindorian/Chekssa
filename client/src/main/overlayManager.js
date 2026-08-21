import { BrowserWindow, screen } from "electron";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { is } from "./env.js";
import { store } from "./store.js";
import { getLocalServerPort } from "./localServer.js";

const currentDir = dirname(fileURLToPath(import.meta.url));

const MIN_WIDTH = 260;
const MAX_WIDTH = 700;
const EXPANDED_SCALE = 640 / 340;
const MIN_HEIGHT = 90;
const MAX_HEIGHT_RATIO = 0.7;

let activeEntry = null;
let queue = [];

export function getCompactWidth(display) {
  const { widthPct } = store.get("overlayPosition");
  const raw = display.workAreaSize.width * widthPct;
  return Math.round(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, raw)));
}

// Shrinks/grows width alongside height (rather than just clamping height on
// its own) so the window's shape always exactly matches the media's real
// aspect ratio - otherwise a mismatch forces a letterbox/pillarbox or, worse,
// a crop on whichever dimension the CSS layer can't reconcile.
export function computeDimensions(baseWidth, aspectRatio, display) {
  const ratio = aspectRatio && aspectRatio > 0 ? aspectRatio : 16 / 9;
  let width = baseWidth;
  let height = width / ratio;

  const maxHeight = display.workAreaSize.height * MAX_HEIGHT_RATIO;
  if (height > maxHeight) {
    height = maxHeight;
    width = height * ratio;
  }
  if (height < MIN_HEIGHT) {
    height = MIN_HEIGHT;
    width = height * ratio;
  }

  return { width, height };
}

const MAX_VIDEO_MS = 10000;
const MAX_IMAGE_MS = 10000;

export function autoCloseDuration(payload) {
  const base = store.get("overlayDurationMs");
  const media = payload?.media;
  const kind = media?.kind;

  if (kind === "youtube" || kind === "local-video") {
    const clipMs = ((media.end ?? 0) - (media.start ?? 0)) * 1000;
    return Math.max(base, clipMs + 1500);
  }
  if (kind === "twitter") {
    const durationMs = media.durationMs > 0 ? Math.min(media.durationMs, MAX_VIDEO_MS) : MAX_VIDEO_MS;
    return Math.max(base, durationMs + 1500);
  }
  if (kind === "tiktok") {
    return Math.max(base, MAX_VIDEO_MS + 1500);
  }
  if (kind === "image" && media.durationMs > 0) {
    return Math.min(media.durationMs, MAX_IMAGE_MS);
  }
  return base;
}

export function boundsForDisplay(display, width, height) {
  const { x, y, width: workWidth, height: workHeight } = display.workArea;
  const { xPct, yPct } = store.get("overlayPosition");
  const left = x + xPct * workWidth;
  const top = y + yPct * workHeight;
  return {
    x: Math.round(Math.min(Math.max(left, x), x + workWidth - width)),
    y: Math.round(Math.min(Math.max(top, y), y + workHeight - height)),
    width: Math.round(width),
    height: Math.round(height),
  };
}

function createOverlayForDisplay(display, payload) {
  const baseWidth = getCompactWidth(display);
  const { width, height } = computeDimensions(baseWidth, payload.media?.aspectRatio, display);
  const bounds = boundsForDisplay(display, width, height);

  const win = new BrowserWindow({
    ...bounds,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    hasShadow: false,
    focusable: true,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: join(currentDir, "../preload/overlay.js"),
      sandbox: false,
      autoplayPolicy: "no-user-gesture-required",
    },
  });

  win.setAlwaysOnTop(true, "screen-saver");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  const entry = { win, display, expanded: false, payload, timer: null };
  activeEntry = entry;

  win.on("closed", () => {
    if (activeEntry === entry) activeEntry = null;
    advanceQueue();
  });

  win.once("ready-to-show", () => {
    win.showInactive();
  });

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/overlay.html`);
  } else {
    win.loadURL(`http://127.0.0.1:${getLocalServerPort()}/overlay.html`);
  }

  win.webContents.once("did-finish-load", () => {
    win.webContents.send("overlay:payload", payload);
    scheduleAutoClose(entry);
  });

  return entry;
}

function scheduleAutoClose(entry) {
  clearTimeout(entry.timer);
  entry.timer = setTimeout(() => {
    if (!entry.win.isDestroyed()) entry.win.close();
  }, autoCloseDuration(entry.payload));
}

function advanceQueue() {
  if (activeEntry || queue.length === 0) return;
  const payload = queue.shift();
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  createOverlayForDisplay(display, payload);
}

export function showBroadcast(payload) {
  queue.push(payload);
  advanceQueue();
}

function entryForSender(webContents) {
  if (!activeEntry) return null;
  const win = BrowserWindow.fromWebContents(webContents);
  return activeEntry.win === win ? activeEntry : null;
}

export function closeOverlay(webContents) {
  const entry = entryForSender(webContents);
  if (entry && !entry.win.isDestroyed()) entry.win.close();
}

export function setOverlayExpanded(webContents, expanded) {
  const entry = entryForSender(webContents);
  if (!entry || entry.win.isDestroyed()) return;

  clearTimeout(entry.timer);
  entry.expanded = expanded;
  const compactWidth = getCompactWidth(entry.display);
  const baseWidth = expanded ? Math.round(compactWidth * EXPANDED_SCALE) : compactWidth;
  const { width, height } = computeDimensions(baseWidth, entry.payload.media?.aspectRatio, entry.display);
  const bounds = boundsForDisplay(entry.display, width, height);
  entry.win.setBounds(bounds);
  entry.win.webContents.send("overlay:expanded-changed", expanded);

  if (!expanded) {
    scheduleAutoClose(entry);
  }
}
