import { useRef } from "react";
import TextLayer from "./TextLayer.jsx";

export default function ImageCanvas({ media, texts, selectedId, onSelect, onMove, onDeselect }) {
  const containerRef = useRef(null);

  if (!media) {
    return (
      <div className="canvas-empty">
        <p>Ajoutez une image, un GIF ou un extrait YouTube pour commencer.</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="canvas-wrap"
      style={{ aspectRatio: media.aspectRatio }}
      onPointerDown={onDeselect}
    >
      {media.kind === "youtube" ? (
        <iframe
          className="canvas-youtube"
          src={`https://www.youtube.com/embed/${media.videoId}?start=${media.start}&end=${media.end}&controls=1&modestbranding=1&rel=0&playsinline=1`}
          title="Extrait YouTube"
          allow="encrypted-media"
          frameBorder="0"
        />
      ) : (
        <img src={media.dataUrl} alt="" draggable={false} />
      )}
      {texts.map((t) => (
        <TextLayer
          key={t.id}
          text={t}
          containerRef={containerRef}
          selected={t.id === selectedId}
          onSelect={onSelect}
          onMove={onMove}
          onDoubleClick={onSelect}
        />
      ))}
    </div>
  );
}
