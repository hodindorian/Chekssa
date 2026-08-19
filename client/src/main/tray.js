import { Tray, Menu, nativeImage } from "electron";
import { ICON_PATH } from "./env.js";

export function createTray({ onOpen, onQuit }) {
  const icon = nativeImage.createFromPath(ICON_PATH).resize({ width: 32, height: 32 });
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
