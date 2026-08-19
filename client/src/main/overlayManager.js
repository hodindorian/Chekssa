import { BrowserWindow, screen } from "electron";
import { join } from "node:path";
import { is } from "./env.js";
import { store } from "./store.js";
import { getLocalServerPort } from "./localServer.js";

const MARGIN = 16;
const COMPACT_WIDTH = 340;
const EXPANDED_WIDTH = 640;
const MIN_HEIGHT = 90;
const MAX_HEIGHT_RATIO = 0.7; // never take more than 70% of the screen height

// Only one overlay is ever on screen at a time; broadcasts that arrive while
// it's showing wait their turn here instead of cutting it off.
let activeEntry = null;
let queue = [];

function computeHeight(width, aspectRatio, display) {
  const ratio = aspectRatio && aspectRatio > 0 ? aspectRatio : 16 / 9;
  const mediaHeight = width / ratio;
  const height = Math.max(MIN_HEIGHT, mediaHeight + 56); // + header/close bar allowance
  const maxHeight = display.workAreaSize.height * MAX_HEIGHT_RATIO;
  return Math.min(height, maxHeight);
}

// Platforms with no seek support (TikTok, X/Twitter, Instagram) always play
// from the start, so their clip is capped at a flat duration rather than an
// explicit start/end range.
const FLAT_VIDEO_CLIP_MS = 17000;

function autoCloseDuration(payload) {
  const base = store.get("overlayDurationMs");
  const kind = payload?.media?.kind;

  if (kind === "youtube" || kind === "local-video") {
    const clipMs = ((payload.media.end ?? 0) - (payload.media.start ?? 0)) * 1000;
    // Let the clip play out in full before moving on to the next queued item.
    return Math.max(base, clipMs + 1500);
  }
  if (kind === "tiktok" || kind === "twitter" || kind === "instagram") {
    return Math.max(base, FLAT_VIDEO_CLIP_MS + 1500);
  }
  return base;
}

function boundsForDisplay(display, width, height) {
  const { x, y, width: workWidth } = display.workArea;
  return {
    x: Math.round(x + workWidth - width - MARGIN),
    y: Math.round(y + MARGIN),
    width: Math.round(width),
    height: Math.round(height),
  };
}

function createOverlayForDisplay(display, payload) {
  const width = COMPACT_WIDTH;
  const height = computeHeight(width, payload.media?.aspectRatio, display);
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
      preload: join(__dirname, "../preload/overlay.js"),
      sandbox: false,
      // YouTube clips must start playing on their own, with no click to trigger them.
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
  // Pick the display fresh for each item: the cursor may have moved since
  // it was queued.
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
  const width = expanded ? EXPANDED_WIDTH : COMPACT_WIDTH;
  const height = computeHeight(width, entry.payload.media?.aspectRatio, entry.display);
  const bounds = boundsForDisplay(entry.display, width, height);
  entry.win.setBounds(bounds);
  entry.win.webContents.send("overlay:expanded-changed", expanded);

  if (!expanded) {
    scheduleAutoClose(entry);
  }
}
