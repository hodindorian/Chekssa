import { autoUpdater } from "electron-updater";

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;

export { autoUpdater };
