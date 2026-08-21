import { randomUUID } from "node:crypto";
import Store from "electron-store";

export const store = new Store({
  defaults: {
    serverUrl: "https://chekssa.hodindorian.com",
    sessionCodes: [],
    displayName: "",
    overlayDurationMs: 10000,
    klipyApiKey: "gcoJyg1y47GSq93dW0ItnAJrB9uTgfdm2PkYSZDw5oroDPl5H3jbViBcfb8vvreT",
    klipyCustomerId: randomUUID(),
    overlayPosition: { xPct: 0.72, yPct: 0.02, widthPct: 0.18 },
  },
});
