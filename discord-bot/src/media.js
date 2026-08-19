import sharp from "sharp";

// Keep these in step with the equivalent guards in the desktop app
// (client/src/renderer/src/components/GifPicker.jsx, LocalVideoPicker.jsx)
// and the server's maxHttpBufferSize (server/src/index.js).
const MAX_GIF_MB = 8;
const MAX_VIDEO_MB = 40;
const MAX_IMAGE_WIDTH = 1200;
export const CLIP_SECONDS = 17;

async function downloadAttachment(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Téléchargement impossible (${res.status}).`);
  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, contentType: res.headers.get("content-type") || "" };
}

export async function buildImageMedia(url, declaredContentType) {
  const { buffer, contentType } = await downloadAttachment(url);
  const isGif = (declaredContentType || contentType).includes("gif");

  if (isGif) {
    if (buffer.length > MAX_GIF_MB * 1024 * 1024) {
      throw new Error(`Ce GIF est trop volumineux (${(buffer.length / 1024 / 1024).toFixed(1)} Mo, max ${MAX_GIF_MB} Mo).`);
    }
    const meta = await sharp(buffer, { animated: true }).metadata();
    return {
      kind: "image",
      dataUrl: `data:image/gif;base64,${buffer.toString("base64")}`,
      aspectRatio: meta.width && meta.height ? meta.width / meta.height : 1,
      isAnimated: true,
      durationMs: 10000,
    };
  }

  // Static image: resize/recompress like the desktop app does before
  // sending (client/src/renderer/src/imageUtils.js resizeImageDataUrl),
  // since phone photos can be several MB straight out of the camera.
  const { data, info } = await sharp(buffer)
    .resize({ width: MAX_IMAGE_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer({ resolveWithObject: true });

  return {
    kind: "image",
    dataUrl: `data:image/jpeg;base64,${data.toString("base64")}`,
    aspectRatio: info.width / info.height,
    isAnimated: false,
    durationMs: 10000,
  };
}

export async function buildLocalVideoMedia(url, start = 0) {
  const { buffer, contentType } = await downloadAttachment(url);
  if (buffer.length > MAX_VIDEO_MB * 1024 * 1024) {
    throw new Error(`Cette vidéo est trop volumineuse (${(buffer.length / 1024 / 1024).toFixed(1)} Mo, max ${MAX_VIDEO_MB} Mo).`);
  }
  const startSec = Math.max(0, Math.floor(start) || 0);
  return {
    kind: "local-video",
    dataUrl: `data:${contentType || "video/mp4"};base64,${buffer.toString("base64")}`,
    start: startSec,
    end: startSec + CLIP_SECONDS,
    // Reading the real aspect ratio needs a video-aware tool (ffprobe) that
    // this bot doesn't ship with - defaults to landscape, so a portrait
    // phone video will letterbox instead of filling the frame exactly.
    aspectRatio: 16 / 9,
  };
}
