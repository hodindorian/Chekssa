// Same approach as client/src/main/videoResolvers.js's resolveTwitterVideo:
// the public syndication endpoint that platform.twitter.com/widgets.js
// itself calls to render embeds. No API key, no Electron dependency, so
// this copy runs as-is in the bot's plain Node process.

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function generateSyndicationToken(tweetId) {
  const raw = ((Number(tweetId) / 1e15) * Math.PI).toString(36);
  return raw.replace(/[0.]/g, "");
}

export async function resolveTwitterVideo(tweetId) {
  const token = generateSyndicationToken(tweetId);
  const res = await fetch(`https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&token=${token}`, {
    headers: { "User-Agent": BROWSER_UA },
  });
  if (!res.ok) {
    throw new Error(res.status === 404 ? "Tweet introuvable (supprimé ou privé)." : `Erreur X/Twitter (${res.status}).`);
  }
  const data = await res.json();

  const media = [data, data.quoted_tweet]
    .filter(Boolean)
    .flatMap((item) => item.mediaDetails || [])
    .find((detail) => detail.type === "video" || detail.type === "animated_gif");

  if (!media) throw new Error("Aucune vidéo trouvée dans ce tweet.");

  const variants = media.video_info?.variants || [];
  const mp4s = variants.filter((v) => v.content_type === "video/mp4" && v.url);
  if (!mp4s.length) throw new Error("Format vidéo non pris en charge.");

  const best = mp4s.reduce((a, b) => ((b.bitrate || 0) > (a.bitrate || 0) ? b : a));
  const width = media.original_info?.width;
  const height = media.original_info?.height;

  return {
    videoUrl: best.url,
    aspectRatio: width && height ? width / height : 16 / 9,
    durationMs: media.video_info?.duration_millis || null,
  };
}
