import Store from "electron-store";

export const store = new Store({
  defaults: {
    serverUrl: "https://chekssa.hodindorian.com",
    sessionCodes: [],
    overlayDurationMs: 10000,
  },
});
