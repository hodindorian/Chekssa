import { autoUpdater } from "electron-updater";

// Reads the same `publish` config already in electron-builder.yml (GitHub
// Releases) - electron-builder bakes that into app-update.yml at package
// time, electron-updater just reads it. No extra setup needed for this to
// find new releases, as long as CI keeps publishing latest.yml alongside
// the installers (it already does via `electron-builder --publish always`).
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;

export { autoUpdater };
