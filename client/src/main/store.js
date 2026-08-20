import { randomUUID } from "node:crypto";
import Store from "electron-store";

export const store = new Store({
  defaults: {
    serverUrl: "https://chekssa.hodindorian.com",
    sessionCodes: [],
    overlayDurationMs: 10000,
    // Shared key baked in so every install gets GIF search out of the box.
    // Restricted on the Klipy dashboard to this app's usage; users can still
    // override it with their own key from the GIF picker.
    klipyApiKey: "gcoJyg1y47GSq93dW0ItnAJrB9uTgfdm2PkYSZDw5oroDPl5H3jbViBcfb8vvreT",
    // Klipy asks for a stable per-installation id (not personal data) to
    // keep search results consistent for a given "user" across requests.
    klipyCustomerId: randomUUID(),
    // Where the overlay popup appears on this user's screen, as fractions
    // of the display's usable work area - so it scales sensibly across
    // different monitor sizes instead of a fixed pixel offset. Defaults to
    // roughly the old hardcoded top-right corner behavior.
    overlayPosition: { xPct: 0.72, yPct: 0.02, widthPct: 0.18 },
  },
});
