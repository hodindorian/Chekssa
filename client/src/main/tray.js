import { Tray, Menu, nativeImage, app } from "electron";

// 16x16 transparent-safe dot icon, base64 PNG, avoids depending on a bundled asset file.
const ICON_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAI0lEQVR4Xu3BAQ0AAADCoPdPbQ43oAAAAAAAAAAAAAAA4N8AGkQAAdI2fdgAAAAASUVORK5CYII=";

export function createTray({ onOpen, onQuit }) {
  const icon = nativeImage.createFromDataURL(ICON_DATA_URL);
  const tray = new Tray(icon);
  tray.setToolTip("Chekssa");

  const menu = Menu.buildFromTemplate([
    { label: "Ouvrir Chekssa", click: onOpen },
    { type: "separator" },
    { label: "Quitter", click: onQuit },
  ]);
  tray.setContextMenu(menu);
  tray.on("click", onOpen);

  return tray;
}
