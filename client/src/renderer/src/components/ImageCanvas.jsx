import { useRef } from "react";
import TextLayer from "./TextLayer.jsx";
import MediaView from "./MediaView.jsx";

export default function ImageCanvas({ media, texts, selectedId, onSelect, onMove, onDeselect }) {
  const containerRef = useRef(null);

  if (!media) {
    return (
      <div className="canvas-empty">
        <p>Ajoutez une image, un GIF ou une vidéo pour commencer.</p>
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
      <MediaView media={media} autoplay={false} className="canvas-media" />
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
