import { ipcMain, BrowserWindow, screen, app } from "electron";
import { socketClient } from "./socketClient.js";
import { closeOverlay, setOverlayExpanded } from "./overlayManager.js";
import { store } from "./store.js";
import { resolveTwitterVideo, checkYoutubeEmbeddable } from "./videoResolvers.js";
import { autoUpdater } from "./updater.js";

function clampFraction(value, min = 0, max = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export function registerIpcHandlers() {
  ipcMain.handle("state:get", () => socketClient.getState());

  ipcMain.handle("session:join", (_event, code) => socketClient.joinSession(code));
  ipcMain.handle("session:leave", (_event, code) => socketClient.leaveSession(code));

  ipcMain.handle("broadcast:send", (_event, payload) => socketClient.sendBroadcast(payload));

  ipcMain.handle("settings:set-server-url", (_event, url) => {
    socketClient.connect(url);
    return socketClient.getState();
  });

  ipcMain.handle("settings:get", () => ({
    klipyApiKey: store.get("klipyApiKey"),
    klipyCustomerId: store.get("klipyCustomerId"),
    overlayPosition: store.get("overlayPosition"),
  }));

  ipcMain.handle("settings:set-klipy-key", (_event, key) => {
    store.set("klipyApiKey", String(key || "").trim());
    return store.get("klipyApiKey");
  });

  ipcMain.handle("settings:set-overlay-position", (_event, position) => {
    const xPct = clampFraction(position?.xPct);
    const yPct = clampFraction(position?.yPct);
    const widthPct = clampFraction(position?.widthPct, 0.08, 0.6);
    const next = { xPct, yPct, widthPct };
    store.set("overlayPosition", next);
    return next;
  });

  ipcMain.handle("video:resolve-twitter", (_event, tweetId) => resolveTwitterVideo(tweetId));
  ipcMain.handle("video:check-youtube", (_event, videoId) => checkYoutubeEmbeddable(videoId));

  ipcMain.handle("update:get-version", () => app.getVersion());

  ipcMain.handle("update:check", () => {
    if (!app.isPackaged) return { ok: false, error: "Pas de vérification de mise à jour en mode développement." };
    return autoUpdater.checkForUpdates().then(
      () => ({ ok: true }),
      (err) => ({ ok: false, error: err?.message || String(err) })
    );
  });

  ipcMain.handle("update:download", () => autoUpdater.downloadUpdate());

  ipcMain.handle("update:install", () => {
    autoUpdater.quitAndInstall();
  });

  // The sidebar no longer scrolls (it used to fight with the send-status
  // toast and slider controls for a jumpy, unreliable scrollbar) - instead
  // the window itself grows/shrinks to fit whatever the sidebar actually
  // needs, clamped to its minimum size and to the screen's usable height.
  ipcMain.on("window:set-content-height", (event, desiredHeight) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || win.isDestroyed()) return;
    const [width, currentHeight] = win.getContentSize();
    const [, minHeight] = win.getMinimumSize();
    const display = screen.getDisplayMatching(win.getBounds());
    const maxHeight = display.workAreaSize.height - 40;
    const targetHeight = Math.max(minHeight, Math.min(Math.round(desiredHeight), maxHeight));
    if (targetHeight !== currentHeight) {
      win.setContentSize(width, targetHeight);
    }
  });

  ipcMain.handle("overlay:close", (event) => {
    closeOverlay(event.sender);
  });

  ipcMain.on("overlay:set-expanded", (event, expanded) => {
    setOverlayExpanded(event.sender, expanded);
  });
}
