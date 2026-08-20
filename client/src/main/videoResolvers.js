// Resolves a social-media link to a direct, playable CDN video URL so the
// overlay can autoplay just the clip - no platform UI chrome, no
// click-to-play. Done in the main process: the syndication endpoint below
// doesn't send an Access-Control-Allow-Origin header permitting a
// renderer-side fetch(), but a Node-side request isn't subject to CORS.

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// --- X / Twitter --------------------------------------------------------
// Uses the public syndication endpoint that platform.twitter.com/widgets.js
// itself calls to render embeds. No API key, well-documented in practice
// (used by tools like yt-dlp). Token derivation verified against yt-dlp's
// Twitter extractor (_generate_syndication_token).

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

// --- YouTube -------------------------------------------------------------
// The iframe embed itself gives no JS-visible error when a video refuses to
// play inside it (deleted, private, or - most commonly - embedding disabled
// by the uploader): the request still succeeds, YouTube's own player just
// renders "Video unavailable" inside the cross-origin frame with nothing we
// can detect from the outside. The public oEmbed endpoint answers the same
// question (does YouTube consider this video embeddable right now) as a
// plain HTTP status, so we can show a clear message instead of a silent
// broken frame. Same CORS reasoning as the Twitter resolver above - done
// from the main process.
export async function checkYoutubeEmbeddable(videoId) {
  const res = await fetch(
    `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`,
    { headers: { "User-Agent": BROWSER_UA } }
  );
  if (res.status === 401 || res.status === 403) {
    throw new Error("Cette vidéo ne peut pas être intégrée (l'auteur a désactivé l'intégration).");
  }
  if (res.status === 404) {
    throw new Error("Vidéo introuvable (supprimée, privée ou lien invalide).");
  }
  if (!res.ok) {
    throw new Error(`Impossible de vérifier cette vidéo YouTube (${res.status}).`);
  }
  return { ok: true };
}
