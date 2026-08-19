import { useEffect, useState } from "react";

export default function Overlay() {
  const [payload, setPayload] = useState(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const off = window.chekssaOverlay.onPayload(setPayload);
    const offExpanded = window.chekssaOverlay.onExpandedChanged(setExpanded);
    return () => {
      off();
      offExpanded();
    };
  }, []);

  if (!payload) return null;

  function toggleExpanded() {
    window.chekssaOverlay.setExpanded(!expanded);
  }

  function handleClose(event) {
    event.stopPropagation();
    window.chekssaOverlay.close();
  }

  return (
    <div className={`overlay-card ${expanded ? "expanded" : ""}`} onClick={toggleExpanded}>
      <button className="overlay-close" onClick={handleClose} title="Fermer">
        ×
      </button>
      <div className="overlay-image-wrap">
        {payload.media?.kind === "youtube" ? (
          <iframe
            className="overlay-youtube"
            src={`https://www.youtube.com/embed/${payload.media.videoId}?start=${payload.media.start}&end=${payload.media.end}&autoplay=1&mute=0&playsinline=1&controls=0&modestbranding=1&rel=0&iv_load_policy=3`}
            title="Extrait YouTube"
            allow="autoplay; encrypted-media"
            frameBorder="0"
          />
        ) : (
          <img src={payload.media?.dataUrl} alt="" draggable={false} />
        )}
        {payload.texts?.map((t) => (
          <span
            key={t.id}
            className="overlay-text"
            style={{
              left: `${t.xPct}%`,
              top: `${t.yPct}%`,
              width: `${t.widthPct ?? 30}%`,
              fontSize: `${t.fontPct || 5}cqw`,
              color: t.color || "#ffffff",
              fontWeight: t.bold ? 700 : 400,
              textAlign: t.align || "left",
            }}
          >
            {t.content}
          </span>
        ))}
      </div>
    </div>
  );
}
