import { useRef, useState } from "react";
import { readFileAsDataUrl } from "../imageUtils.js";

const CLIP_SECONDS = 17;
const MAX_FILE_MB = 40;

export default function LocalVideoPicker({ onInsert, onCancel }) {
  const [dataUrl, setDataUrl] = useState(null);
  const [aspectRatio, setAspectRatio] = useState(16 / 9);
  const [start, setStart] = useState(0);
  const [error, setError] = useState(null);
  const [fileName, setFileName] = useState("");
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);

  async function handleFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("video/")) {
      setError("Ce fichier n'est pas une vidéo.");
      return;
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`Fichier trop volumineux (max ${MAX_FILE_MB} Mo).`);
      return;
    }
    setFileName(file.name);
    setStart(0);
    setDataUrl(await readFileAsDataUrl(file));
  }

  function handleLoadedMetadata() {
    const v = videoRef.current;
    if (!v) return;
    setAspectRatio(v.videoWidth && v.videoHeight ? v.videoWidth / v.videoHeight : 16 / 9);
  }

  const startSec = Math.max(0, Math.floor(start) || 0);
  const endSec = startSec + CLIP_SECONDS;

  function seekPreview() {
    if (videoRef.current) videoRef.current.currentTime = startSec;
  }

  function insert() {
    if (!dataUrl) return;
    onInsert({ kind: "local-video", dataUrl, start: startSec, end: endSec, aspectRatio });
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal youtube-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Ajouter une vidéo locale</h3>

        {!dataUrl ? (
          <>
            <button type="button" onClick={() => fileInputRef.current?.click()}>
              Choisir un fichier vidéo (MP4)
            </button>
            <input ref={fileInputRef} type="file" accept="video/*" onChange={handleFile} style={{ display: "none" }} />
          </>
        ) : (
          <>
            <p className="hint">{fileName}</p>
            <div className={`youtube-preview ${aspectRatio < 1 ? "portrait" : "landscape"}`}>
              <video ref={videoRef} src={dataUrl} controls onLoadedMetadata={handleLoadedMetadata} />
            </div>
            <label className="youtube-start-label">
              Timestamp de début (secondes)
              <input type="number" min={0} value={start} onChange={(e) => setStart(Number(e.target.value))} />
            </label>
            <p className="hint">
              Extrait joué de {formatTime(startSec)} à {formatTime(endSec)} ({CLIP_SECONDS}s max — coupé plus tôt si
              la vidéo se termine avant).
            </p>
            <button type="button" onClick={seekPreview}>
              Aller à ce timestamp
            </button>
          </>
        )}

        {error && <p className="connection-error">{error}</p>}

        <div className="modal-actions">
          <button type="button" onClick={onCancel}>
            Annuler
          </button>
          <button type="button" className="primary" disabled={!dataUrl} onClick={insert}>
            Insérer
          </button>
        </div>
      </div>
    </div>
  );
}

function formatTime(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds) || 0);
  const m = Math.floor(s / 60);
  const sec = String(s % 60).padStart(2, "0");
  return `${m}:${sec}`;
}
