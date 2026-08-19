import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("chekssaOverlay", {
  onPayload: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("overlay:payload", listener);
    return () => ipcRenderer.removeListener("overlay:payload", listener);
  },
  onExpandedChanged: (callback) => {
    const listener = (_event, expanded) => callback(expanded);
    ipcRenderer.on("overlay:expanded-changed", listener);
    return () => ipcRenderer.removeListener("overlay:expanded-changed", listener);
  },
  close: () => ipcRenderer.invoke("overlay:close"),
  setExpanded: (expanded) => ipcRenderer.send("overlay:set-expanded", expanded),
});
