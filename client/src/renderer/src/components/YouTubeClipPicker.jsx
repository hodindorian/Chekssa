import { useState } from "react";

const CLIP_SECONDS = 17;

export default function YouTubeClipPicker({ onInsert, onCancel }) {
  const [urlInput, setUrlInput] = useState("");
  const [parsed, setParsed] = useState(null); // { videoId, isShort }
  const [start, setStart] = useState(0);
  const [error, setError] = useState(null);
  const [previewKey, setPreviewKey] = useState(0);
  const [showPreview, setShowPreview] = useState(false);

  function handleUrlChange(value) {
    setUrlInput(value);
    setShowPreview(false);
    const result = parseYoutubeUrl(value);
    if (!result) {
      setParsed(null);
      setError(value.trim() ? "Lien YouTube non reconnu." : null);
      return;
    }
    setError(null);
    setParsed(result);
    if (result.startFromUrl != null) setStart(result.startFromUrl);
  }

  const startSec = Math.max(0, Math.floor(start) || 0);
  const endSec = startSec + CLIP_SECONDS;

  function preview() {
    if (!parsed) return;
    setShowPreview(true);
    setPreviewKey((k) => k + 1);
  }

  function insert() {
    if (!parsed) return;
    onInsert({
      videoId: parsed.videoId,
      start: startSec,
      end: endSec,
      aspectRatio: parsed.isShort ? 9 / 16 : 16 / 9,
    });
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal youtube-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Ajouter un extrait YouTube</h3>
        <input
          autoFocus
          value={urlInput}
          onChange={(e) => handleUrlChange(e.target.value)}
          placeholder="Lien d'une vidéo ou d'un short YouTube"
        />
        {error && <p className="connection-error">{error}</p>}

        {parsed && (
          <>
            <label className="youtube-start-label">
              Timestamp de début (secondes)
              <input type="number" min={0} value={start} onChange={(e) => setStart(Number(e.target.value))} />
            </label>
            <p className="hint">
              Extrait joué de {formatTime(startSec)} à {formatTime(endSec)} ({CLIP_SECONDS}s max — coupé plus tôt si
              la vidéo se termine avant).
            </p>
            <button type="button" onClick={preview}>
              Prévisualiser
            </button>
            {showPreview && (
              <div className={`youtube-preview ${parsed.isShort ? "portrait" : "landscape"}`}>
                <iframe
                  key={previewKey}
                  src={`https://www.youtube.com/embed/${parsed.videoId}?start=${startSec}&end=${endSec}&autoplay=1&playsinline=1&modestbranding=1&rel=0`}
                  title="Aperçu YouTube"
                  allow="autoplay; encrypted-media"
                  frameBorder="0"
                />
              </div>
            )}
          </>
        )}

        <div className="modal-actions">
          <button type="button" onClick={onCancel}>
            Annuler
          </button>
          <button type="button" className="primary" disabled={!parsed} onClick={insert}>
            Insérer
          </button>
        </div>
      </div>
    </div>
  );
}

function parseYoutubeUrl(input) {
  const trimmed = input.trim();
  if (!trimmed) return null;
  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\.|^m\./, "");
  let videoId = null;
  let isShort = false;

  if (host === "youtu.be") {
    videoId = url.pathname.split("/").filter(Boolean)[0] || null;
  } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments[0] === "shorts" && segments[1]) {
      videoId = segments[1];
      isShort = true;
    } else if (segments[0] === "embed" && segments[1]) {
      videoId = segments[1];
    } else {
      videoId = url.searchParams.get("v");
    }
  } else {
    return null;
  }

  if (!videoId) return null;

  const tParam = url.searchParams.get("t") || url.searchParams.get("start");
  const startFromUrl = tParam ? parseTimeParam(tParam) : null;

  return { videoId, isShort, startFromUrl };
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
