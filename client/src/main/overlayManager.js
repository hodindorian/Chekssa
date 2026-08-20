import { BrowserWindow, screen } from "electron";
import { join } from "node:path";
import { is } from "./env.js";
import { store } from "./store.js";
import { getLocalServerPort } from "./localServer.js";

const MIN_WIDTH = 260;
const MAX_WIDTH = 700;
// Preserves the old compact->expanded ratio (was a fixed 340 -> 640).
const EXPANDED_SCALE = 640 / 340;
const MIN_HEIGHT = 90;
const MAX_HEIGHT_RATIO = 0.7; // never take more than 70% of the screen height

// Only one overlay is ever on screen at a time; broadcasts that arrive while
// it's showing wait their turn here instead of cutting it off.
let activeEntry = null;
let queue = [];

// The user picks this in the "Position des notifications" settings modal
// (client/src/renderer/src/components/OverlayPositionPicker.jsx) - stored
// as fractions of the screen so it scales across monitor sizes.
function getCompactWidth(display) {
  const { widthPct } = store.get("overlayPosition");
  const raw = display.workAreaSize.width * widthPct;
  return Math.round(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, raw)));
}

function computeHeight(width, aspectRatio, display) {
  const ratio = aspectRatio && aspectRatio > 0 ? aspectRatio : 16 / 9;
  const mediaHeight = width / ratio;
  const height = Math.max(MIN_HEIGHT, mediaHeight + 56); // + header/close bar allowance
  const maxHeight = display.workAreaSize.height * MAX_HEIGHT_RATIO;
  return Math.min(height, maxHeight);
}

// Safety ceiling for video kinds that play their own real length (twitter)
// instead of an explicit chosen start/end range - stops one long video from
// blocking the queue for everyone else's memes. Also used as the flat
// fallback duration for tiktok's iframe, which has no duration available.
// Local MP4 files keep their own longer clip length (see LocalVideoPicker.jsx).
const MAX_VIDEO_MS = 10000;
// Images/GIFs let the sender pick a display time in the composer, capped
// client-side too - re-capped here in case an older/other client sends more.
const MAX_IMAGE_MS = 10000;

function autoCloseDuration(payload) {
  const base = store.get("overlayDurationMs");
  const media = payload?.media;
  const kind = media?.kind;

  if (kind === "youtube" || kind === "local-video") {
    const clipMs = ((media.end ?? 0) - (media.start ?? 0)) * 1000;
    // Let the clip play out in full before moving on to the next queued item.
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

function boundsForDisplay(display, width, height) {
  const { x, y, width: workWidth, height: workHeight } = display.workArea;
  const { xPct, yPct } = store.get("overlayPosition");
  const left = x + xPct * workWidth;
  const top = y + yPct * workHeight;
  // Clamp so the box always stays fully on-screen, even if it was
  // positioned near an edge and then grew (e.g. on expand) or the user
  // moved to a smaller monitor since choosing this spot.
  return {
    x: Math.round(Math.min(Math.max(left, x), x + workWidth - width)),
    y: Math.round(Math.min(Math.max(top, y), y + workHeight - height)),
    width: Math.round(width),
    height: Math.round(height),
  };
}

function createOverlayForDisplay(display, payload) {
  const width = getCompactWidth(display);
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
  const compactWidth = getCompactWidth(entry.display);
  const width = expanded ? Math.round(compactWidth * EXPANDED_SCALE) : compactWidth;
  const height = computeHeight(width, entry.payload.media?.aspectRatio, entry.display);
  const bounds = boundsForDisplay(entry.display, width, height);
  entry.win.setBounds(bounds);
  entry.win.webContents.send("overlay:expanded-changed", expanded);

  if (!expanded) {
    scheduleAutoClose(entry);
  }
}
