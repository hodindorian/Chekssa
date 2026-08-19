import Store from "electron-store";

export const store = new Store({
  defaults: {
    serverUrl: "http://localhost:4000",
    sessionCodes: [],
    overlayDurationMs: 10000,
  },
});
