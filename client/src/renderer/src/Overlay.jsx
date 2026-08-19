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
        <img src={payload.imageDataUrl} alt="" draggable={false} />
        {payload.texts?.map((t) => (
          <span
            key={t.id}
            className="overlay-text"
            style={{
              left: `${t.xPct}%`,
              top: `${t.yPct}%`,
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
