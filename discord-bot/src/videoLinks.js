// Same parsing logic as client/src/renderer/src/components/VideoLinkPicker.jsx
// (parseVideoUrl and friends) - pure URL parsing, no browser/Electron APIs,
// so it's copied as-is rather than shared across two very different runtimes.

export function parseVideoUrl(input) {
  const trimmed = (input || "").trim();
  if (!trimmed) return null;
  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\.|^m\.|^vm\./, "");

  if (host === "youtu.be" || host === "youtube.com" || host === "youtube-nocookie.com") {
    return parseYoutube(url, host);
  }
  if (host === "tiktok.com") {
    return parseTikTok(url);
  }
  if (host === "twitter.com" || host === "x.com") {
    return parseTwitter(url);
  }
  return null;
}

function parseYoutube(url, host) {
  let videoId = null;
  let isShort = false;

  if (host === "youtu.be") {
    videoId = url.pathname.split("/").filter(Boolean)[0] || null;
  } else {
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments[0] === "shorts" && segments[1]) {
      videoId = segments[1];
      isShort = true;
    } else if (segments[0] === "embed" && segments[1]) {
      videoId = segments[1];
    } else {
      videoId = url.searchParams.get("v");
    }
  }
  if (!videoId) return null;

  const tParam = url.searchParams.get("t") || url.searchParams.get("start");
  const startFromUrl = tParam ? parseTimeParam(tParam) : null;

  return { platform: "youtube", videoId, startFromUrl, aspectRatio: isShort ? 9 / 16 : 16 / 9 };
}

function parseTikTok(url) {
  const segments = url.pathname.split("/").filter(Boolean);
  const videoIndex = segments.indexOf("video");
  const videoId = videoIndex >= 0 ? segments[videoIndex + 1] : null;
  if (!videoId || !/^\d+$/.test(videoId)) return null;
  return { platform: "tiktok", videoId, aspectRatio: 9 / 16 };
}

function parseTwitter(url) {
  const match = url.pathname.match(/\/status\/(\d+)/);
  if (!match) return null;
  return { platform: "twitter", tweetId: match[1] };
}

function parseTimeParam(raw) {
  if (/^\d+$/.test(raw)) return Number(raw);
  const match = raw.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!match) return null;
  const [, h, m, s] = match;
  const total = (Number(h) || 0) * 3600 + (Number(m) || 0) * 60 + (Number(s) || 0);
  return total || null;
}
