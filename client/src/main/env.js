import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export const is = {
  dev: !!process.env.ELECTRON_RENDERER_URL,
};

const currentDir = dirname(fileURLToPath(import.meta.url));
export const ICON_PATH = join(currentDir, "../../build/icon.png");
