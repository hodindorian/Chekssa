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

let mainWindow = null;
let tray = null;
app.isQuitting = false;

function createMainWindow() {
  const win = new BrowserWindow({
    width: 980,
    height: 720,
    minWidth: 760,
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

    mainWindow = createMainWindow();

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
