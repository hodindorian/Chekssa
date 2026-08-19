import { ipcMain } from "electron";
import { socketClient } from "./socketClient.js";
import { closeOverlay, setOverlayExpanded } from "./overlayManager.js";
import { store } from "./store.js";

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

  ipcMain.handle("overlay:close", (event) => {
    closeOverlay(event.sender);
  });

  ipcMain.on("overlay:set-expanded", (event, expanded) => {
    setOverlayExpanded(event.sender, expanded);
  });
}
