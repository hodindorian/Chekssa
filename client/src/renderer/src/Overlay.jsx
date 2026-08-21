import { useEffect, useState } from "react";
import MediaView from "./components/MediaView.jsx";

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
      {payload.sender && <span className="overlay-sender">{payload.sender}</span>}
      <div className="overlay-image-wrap">
        <MediaView
          media={payload.media}
          autoplay
          className="overlay-media"
          onEnded={() => window.chekssaOverlay.close()}
        />
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
