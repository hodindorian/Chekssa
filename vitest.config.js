import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["server/src/**/*.test.js", "client/src/main/**/*.test.js", "discord-bot/src/**/*.test.js"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["server/src/**/*.js", "client/src/main/**/*.js", "discord-bot/src/**/*.js"],
      exclude: [
        "**/*.test.js",
        "server/src/index.js",
        "client/src/main/index.js",
        "client/src/main/tray.js",
        "client/src/main/ipcHandlers.js",
        "client/src/main/store.js",
        "client/src/main/localServer.js",
        "client/src/main/stripVideoReferrer.js",
        "client/src/main/updater.js",
        "discord-bot/src/index.js",
        "discord-bot/src/commands.js",
        "discord-bot/src/registerCommands.js",
      ],
    },
  },
});
