import { ipcMain, BrowserWindow, screen } from "electron";
import { socketClient } from "./socketClient.js";
import { closeOverlay, setOverlayExpanded } from "./overlayManager.js";
import { store } from "./store.js";
import { resolveTwitterVideo } from "./videoResolvers.js";

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
  }));

  ipcMain.handle("settings:set-klipy-key", (_event, key) => {
    store.set("klipyApiKey", String(key || "").trim());
    return store.get("klipyApiKey");
  });

  ipcMain.handle("video:resolve-twitter", (_event, tweetId) => resolveTwitterVideo(tweetId));

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
