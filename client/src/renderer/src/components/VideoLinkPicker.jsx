import { useEffect, useState } from "react";
import MediaView from "./MediaView.jsx";

const CLIP_SECONDS = 10;

const PLATFORM_LABELS = {
  youtube: "YouTube",
  tiktok: "TikTok",
  twitter: "X / Twitter",
};

// ipcRenderer.invoke wraps a thrown main-process error as
// "Error invoking remote method '...': Error: <message>" - strip that back
// down to the actual message before showing it.
function cleanIpcError(err, fallback) {
  const raw = err?.message || String(err || "");
  const cleaned = raw.replace(/^Error invoking remote method '[^']*':\s*(Error:\s*)?/, "");
  return cleaned || fallback;
}

export default function VideoLinkPicker({ onInsert, onCancel }) {
  const [urlInput, setUrlInput] = useState("");
  const [parsed, setParsed] = useState(null);
  const [start, setStart] = useState(0);
  const [error, setError] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  // X/Twitter has no seekable/plain embed: the tweet's video has to be
  // resolved to a direct CDN link first (see videoResolvers.js, main
  // process - avoids CORS).
  const [twitterVideo, setTwitterVideo] = useState(null);
  const [twitterLoading, setTwitterLoading] = useState(false);
  const [twitterError, setTwitterError] = useState(null);

  useEffect(() => {
    if (parsed?.platform !== "twitter") return undefined;
    let cancelled = false;
    setTwitterVideo(null);
    setTwitterError(null);
    setTwitterLoading(true);
    window.chekssa
      .resolveTwitterVideo(parsed.tweetId)
      .then((result) => {
        if (!cancelled) setTwitterVideo(result);
      })
      .catch((err) => {
        if (!cancelled) setTwitterError(cleanIpcError(err, "Impossible de récupérer la vidéo de ce tweet."));
      })
      .finally(() => {
        if (!cancelled) setTwitterLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [parsed?.platform, parsed?.tweetId]);

  // The iframe embed gives no visible error when YouTube itself refuses to
  // play a video inside it (embedding disabled by the uploader, deleted,
  // private...) - it just silently shows "Video unavailable" with nothing we
  // can detect. Ask the oEmbed endpoint up front instead (see
  // videoResolvers.js) so we can show a clear reason rather than a
  // confusing blank/broken preview.
  const [youtubeChecking, setYoutubeChecking] = useState(false);
  const [youtubeError, setYoutubeError] = useState(null);

  useEffect(() => {
    if (parsed?.platform !== "youtube") return undefined;
    let cancelled = false;
    setYoutubeError(null);
    setYoutubeChecking(true);
    window.chekssa
      .checkYoutubeEmbeddable(parsed.videoId)
      .catch((err) => {
        if (!cancelled) setYoutubeError(cleanIpcError(err, "Cette vidéo YouTube n'est pas disponible."));
      })
      .finally(() => {
        if (!cancelled) setYoutubeChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [parsed?.platform, parsed?.videoId]);

  function handleUrlChange(value) {
    setUrlInput(value);
    setShowPreview(false);
    setTwitterVideo(null);
    setTwitterError(null);
    const result = parseVideoUrl(value);
    if (!result) {
      setParsed(null);
      setError(value.trim() ? "Lien non reconnu (YouTube, TikTok ou X/Twitter)." : null);
      return;
    }
    setError(null);
    setParsed(result);
    if (result.startFromUrl != null) setStart(result.startFromUrl);
  }

  const startSec = Math.max(0, Math.floor(start) || 0);
  const endSec = startSec + CLIP_SECONDS;
  const seekable = parsed?.platform === "youtube";
  const canInsert =
    parsed &&
    (parsed.platform !== "twitter" || !!twitterVideo) &&
    (parsed.platform !== "youtube" || (!youtubeChecking && !youtubeError));

  function insert() {
    if (!canInsert) return;
    if (parsed.platform === "youtube") {
      onInsert({ kind: "youtube", videoId: parsed.videoId, start: startSec, end: endSec, aspectRatio: parsed.aspectRatio });
    } else if (parsed.platform === "tiktok") {
      onInsert({ kind: "tiktok", videoId: parsed.videoId, aspectRatio: parsed.aspectRatio });
    } else if (parsed.platform === "twitter") {
      onInsert({
        kind: "twitter",
        videoUrl: twitterVideo.videoUrl,
        aspectRatio: twitterVideo.aspectRatio,
        durationMs: twitterVideo.durationMs,
      });
    }
  }

  const previewMedia = parsed
    ? parsed.platform === "youtube"
      ? !youtubeChecking && !youtubeError && { kind: "youtube", videoId: parsed.videoId, start: startSec, end: endSec }
      : parsed.platform === "tiktok"
        ? { kind: "tiktok", videoId: parsed.videoId }
        : twitterVideo && { kind: "twitter", videoUrl: twitterVideo.videoUrl }
    : null;

  const previewAspectRatio = parsed?.platform === "twitter" ? twitterVideo?.aspectRatio ?? 16 / 9 : parsed?.aspectRatio;

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal youtube-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Ajouter une vidéo (lien)</h3>
        <input
          autoFocus
          value={urlInput}
          onChange={(e) => handleUrlChange(e.target.value)}
          placeholder="Lien YouTube, TikTok ou X/Twitter"
        />
        {error && <p className="connection-error">{error}</p>}

        {parsed && (
          <>
            <p className="hint">Plateforme détectée : {PLATFORM_LABELS[parsed.platform]}.</p>

            {seekable ? (
              <>
                <label className="youtube-start-label">
                  Timestamp de début (secondes)
                  <input type="number" min={0} value={start} onChange={(e) => setStart(Number(e.target.value))} />
                </label>
                <p className="hint">
                  Extrait joué de {formatTime(startSec)} à {formatTime(endSec)} ({CLIP_SECONDS}s max — coupé plus tôt
                  si la vidéo se termine avant).
                </p>
              </>
            ) : (
              <p className="hint">
                {PLATFORM_LABELS[parsed.platform]} ne permet pas de choisir un instant précis : la vidéo est jouée
                depuis le début, l'affichage dure toute sa longueur ({CLIP_SECONDS}s max).
              </p>
            )}

            {parsed.platform === "twitter" && twitterLoading && <p className="hint">Récupération de la vidéo…</p>}
            {parsed.platform === "twitter" && twitterError && <p className="connection-error">{twitterError}</p>}

            {parsed.platform === "youtube" && youtubeChecking && <p className="hint">Vérification de la vidéo…</p>}
            {parsed.platform === "youtube" && youtubeError && <p className="connection-error">{youtubeError}</p>}

            {previewMedia && (
              <>
                <button type="button" onClick={() => setShowPreview(true)}>
                  Prévisualiser
                </button>
                {showPreview && (
                  <div className={`youtube-preview ${previewAspectRatio < 1 ? "portrait" : "landscape"}`}>
                    <MediaView
                      media={previewMedia}
                      autoplay={parsed.platform === "youtube" || parsed.platform === "tiktok" || parsed.platform === "twitter"}
                    />
                  </div>
                )}
              </>
            )}
          </>
        )}

        <div className="modal-actions">
          <button type="button" onClick={onCancel}>
            Annuler
          </button>
          <button type="button" className="primary" disabled={!canInsert} onClick={insert}>
            Insérer
          </button>
        </div>
      </div>
    </div>
  );
}

function parseVideoUrl(input) {
  const trimmed = input.trim();
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
  return { platform: "twitter", tweetId: match[1], aspectRatio: 16 / 9 };
}

function parseTimeParam(raw) {
  if (/^\d+$/.test(raw)) return Number(raw);
  const match = raw.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!match) return null;
  const [, h, m, s] = match;
  const total = (Number(h) || 0) * 3600 + (Number(m) || 0) * 60 + (Number(s) || 0);
  return total || null;
}

function formatTime(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds) || 0);
  const m = Math.floor(s / 60);
  const sec = String(s % 60).padStart(2, "0");
  return `${m}:${sec}`;
}
