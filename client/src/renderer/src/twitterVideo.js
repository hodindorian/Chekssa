// X/Twitter has no plain iframe embed and its official widget always shows
// the full tweet card (author, text, buttons) with playback requiring a
// click - not what we want for an overlay that should just autoplay the
// clip. Instead we resolve the tweet's own public syndication endpoint
// (the same one widgets.js itself calls, no API key/auth needed) to get a
// direct CDN video URL and play that in a bare <video> element.
//
// Token derivation and JSON shape verified against yt-dlp's Twitter
// extractor (yt_dlp/extractor/twitter.py, _generate_syndication_token /
// _call_syndication_api), an actively maintained reference for this
// undocumented-but-stable endpoint.

function generateSyndicationToken(tweetId) {
  const raw = ((Number(tweetId) / 1e15) * Math.PI).toString(36);
  return raw.replace(/[0.]/g, "");
}

export async function resolveTweetVideo(tweetId) {
  const token = generateSyndicationToken(tweetId);
  const res = await fetch(`https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&token=${token}`);
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
  };
}
