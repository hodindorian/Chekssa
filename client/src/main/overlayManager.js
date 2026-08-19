import { BrowserWindow, screen } from "electron";
import { join } from "node:path";
import { is } from "./env.js";
import { store } from "./store.js";

const MARGIN = 16;
const COMPACT_WIDTH = 340;
const EXPANDED_WIDTH = 640;
const MIN_HEIGHT = 90;
const MAX_HEIGHT_RATIO = 0.7; // never take more than 70% of the screen height

let windows = [];

function computeHeight(width, imageAspectRatio, display) {
  const ratio = imageAspectRatio && imageAspectRatio > 0 ? imageAspectRatio : 16 / 9;
  const imageHeight = width / ratio;
  const height = Math.max(MIN_HEIGHT, imageHeight + 56); // + header/close bar allowance
  const maxHeight = display.workAreaSize.height * MAX_HEIGHT_RATIO;
  return Math.min(height, maxHeight);
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

function closeAll() {
  for (const entry of windows) {
    clearTimeout(entry.timer);
    if (!entry.win.isDestroyed()) entry.win.close();
  }
  windows = [];
}

function createOverlayForDisplay(display, payload) {
  const width = COMPACT_WIDTH;
  const height = computeHeight(width, payload.imageAspectRatio, display);
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
    },
  });

  win.setAlwaysOnTop(true, "screen-saver");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  const entry = { win, display, expanded: false, payload, timer: null };
  windows.push(entry);

  win.on("closed", () => {
    windows = windows.filter((e) => e !== entry);
  });

  win.once("ready-to-show", () => {
    win.showInactive();
  });

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/overlay.html`);
  } else {
    win.loadFile(join(__dirname, "../renderer/overlay.html"));
  }

  win.webContents.once("did-finish-load", () => {
    win.webContents.send("overlay:payload", payload);
    scheduleAutoClose(entry);
  });

  return entry;
}

function scheduleAutoClose(entry) {
  clearTimeout(entry.timer);
  const duration = store.get("overlayDurationMs");
  entry.timer = setTimeout(() => {
    if (!entry.win.isDestroyed()) entry.win.close();
  }, duration);
}

export function showBroadcast(payload) {
  closeAll();
  // Show on a single screen only: whichever one the cursor is currently on,
  // since that's the one the recipient is most likely actually looking at.
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  createOverlayForDisplay(display, payload);
}

function entryForSender(webContents) {
  const win = BrowserWindow.fromWebContents(webContents);
  return windows.find((e) => e.win === win);
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
  const height = computeHeight(width, entry.payload.imageAspectRatio, entry.display);
  const bounds = boundsForDisplay(entry.display, width, height);
  entry.win.setBounds(bounds);
  entry.win.webContents.send("overlay:expanded-changed", expanded);

  if (!expanded) {
    scheduleAutoClose(entry);
  }
}
