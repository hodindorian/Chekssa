import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("chekssa", {
  getState: () => ipcRenderer.invoke("state:get"),
  onStateChanged: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("state:changed", listener);
    return () => ipcRenderer.removeListener("state:changed", listener);
  },
  joinSession: (code) => ipcRenderer.invoke("session:join", code),
  leaveSession: (code) => ipcRenderer.invoke("session:leave", code),
  sendBroadcast: (payload) => ipcRenderer.invoke("broadcast:send", payload),
  setServerUrl: (url) => ipcRenderer.invoke("settings:set-server-url", url),
  getSettings: () => ipcRenderer.invoke("settings:get"),
  setKlipyApiKey: (key) => ipcRenderer.invoke("settings:set-klipy-key", key),
  setDisplayName: (name) => ipcRenderer.invoke("settings:set-display-name", name),
  setOverlayPosition: (position) => ipcRenderer.invoke("settings:set-overlay-position", position),
  resolveTwitterVideo: (tweetId) => ipcRenderer.invoke("video:resolve-twitter", tweetId),
  checkYoutubeEmbeddable: (videoId) => ipcRenderer.invoke("video:check-youtube", videoId),
  setWindowContentHeight: (height) => ipcRenderer.send("window:set-content-height", height),
  getAppVersion: () => ipcRenderer.invoke("update:get-version"),
  checkForUpdates: () => ipcRenderer.invoke("update:check"),
  downloadUpdate: () => ipcRenderer.invoke("update:download"),
  installUpdate: () => ipcRenderer.invoke("update:install"),
  onUpdateStatus: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on("update:status", listener);
    return () => ipcRenderer.removeListener("update:status", listener);
  },
});
