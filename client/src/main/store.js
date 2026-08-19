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
  },
});
