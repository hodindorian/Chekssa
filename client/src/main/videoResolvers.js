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

async function detectYoutubeLicenseBlock(videoId) {
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: { "User-Agent": BROWSER_UA, "Accept-Language": "fr-FR,fr;q=0.9" },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const status = html.match(/"playabilityStatus":\s*\{"status":"([A-Z_]+)"/)?.[1];
    if (!status || status === "OK") return null;
    const reason = html.match(/"reason":"([^"]*)"/)?.[1] || "";
    if (/copyright|licen[cs]|content id|claim/i.test(reason)) {
      return "Vidéo sous licence : diffusion impossible.";
    }
    return reason ? `Vidéo indisponible : ${reason}` : "Cette vidéo n'est pas disponible en intégration.";
  } catch {
    return null;
  }
}

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

  const licenseIssue = await detectYoutubeLicenseBlock(videoId);
  if (licenseIssue) throw new Error(licenseIssue);

  return { ok: true };
}
