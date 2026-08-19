import { join } from "node:path";

export const is = {
  dev: !!process.env.ELECTRON_RENDERER_URL,
};

export const ICON_PATH = join(__dirname, "../../build/icon.png");
