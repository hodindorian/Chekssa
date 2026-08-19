import { useRef } from "react";
import TextLayer from "./TextLayer.jsx";

export default function ImageCanvas({ image, texts, selectedId, onSelect, onMove, onDeselect }) {
  const containerRef = useRef(null);

  if (!image) {
    return (
      <div className="canvas-empty">
        <p>Ajoutez une image pour commencer.</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="canvas-wrap"
      style={{ aspectRatio: image.aspectRatio }}
      onPointerDown={onDeselect}
    >
      <img src={image.dataUrl} alt="" draggable={false} />
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
