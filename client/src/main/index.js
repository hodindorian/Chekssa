import { app, BrowserWindow, shell } from "electron";
import { join } from "node:path";
import { is, ICON_PATH } from "./env.js";
import { store } from "./store.js";
import { socketClient } from "./socketClient.js";
import { createTray } from "./tray.js";
import { registerIpcHandlers } from "./ipcHandlers.js";
import { showBroadcast } from "./overlayManager.js";
import { startLocalServer, getLocalServerPort } from "./localServer.js";
import { stripVideoCdnReferrer } from "./stripVideoReferrer.js";
import { autoUpdater } from "./updater.js";

let mainWindow = null;
let tray = null;
app.isQuitting = false;

function createMainWindow() {
  const win = new BrowserWindow({
    width: 980,
    height: 720,
    // 320px sidebar + 320px text panel (when a text is selected) + enough
    // left over for the canvas to stay usable.
    minWidth: 900,
    minHeight: 560,
    show: false,
    autoHideMenuBar: true,
    icon: ICON_PATH,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
    },
  });

  win.on("ready-to-show", () => win.show());

  win.on("close", (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      win.hide();
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    win.loadURL(`http://127.0.0.1:${getLocalServerPort()}/index.html`);
  }

  return win;
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    mainWindow = createMainWindow();
  } else {
    mainWindow.show();
  }
  mainWindow.focus();
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => showMainWindow());

  app.whenReady().then(async () => {
    registerIpcHandlers();
    stripVideoCdnReferrer();

    if (!is.dev) {
      await startLocalServer(join(__dirname, "../renderer"));
    }

    socketClient.on("state-changed", (state) => {
      mainWindow?.webContents.send("state:changed", state);
    });
    socketClient.on("broadcast-receive", (payload) => {
      showBroadcast(payload);
    });
    socketClient.connect(store.get("serverUrl"));

    autoUpdater.on("checking-for-update", () => {
      mainWindow?.webContents.send("update:status", { state: "checking" });
    });
    autoUpdater.on("update-available", (info) => {
      mainWindow?.webContents.send("update:status", { state: "available", version: info.version });
    });
    autoUpdater.on("update-not-available", () => {
      mainWindow?.webContents.send("update:status", { state: "not-available" });
    });
    autoUpdater.on("download-progress", (progress) => {
      mainWindow?.webContents.send("update:status", { state: "downloading", progress: Math.round(progress.percent) });
    });
    autoUpdater.on("update-downloaded", (info) => {
      mainWindow?.webContents.send("update:status", { state: "downloaded", version: info.version });
    });
    autoUpdater.on("error", (err) => {
      mainWindow?.webContents.send("update:status", { state: "error", error: err?.message || String(err) });
    });

    mainWindow = createMainWindow();

    // Only in a real packaged build: electron-updater needs the
    // app-update.yml electron-builder generates at package time, which
    // doesn't exist when just running from source.
    if (app.isPackaged) {
      autoUpdater.checkForUpdates().catch(() => {
        // Already surfaced to the renderer via the 'error' listener above.
      });
    }

    tray = createTray({
      onOpen: () => showMainWindow(),
      onQuit: () => {
        app.isQuitting = true;
        app.quit();
      },
    });

    if (process.platform === "darwin") {
      app.dock?.setIcon(ICON_PATH);
    }

    app.on("activate", () => showMainWindow());
  });

  app.on("window-all-closed", () => {
    // Keep running in the background (tray) instead of quitting.
  });
}
