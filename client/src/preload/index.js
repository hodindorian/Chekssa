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
});
