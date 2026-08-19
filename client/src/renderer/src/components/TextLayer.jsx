import { useRef } from "react";

export default function TextLayer({ text, containerRef, selected, onSelect, onMove, onDoubleClick }) {
  const dragging = useRef(false);

  function handlePointerDown(event) {
    event.stopPropagation();
    onSelect(text.id);
    dragging.current = true;
    event.target.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event) {
    if (!dragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const xPct = clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100);
    const yPct = clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100);
    onMove(text.id, { xPct, yPct });
  }

  function handlePointerUp(event) {
    dragging.current = false;
    event.target.releasePointerCapture?.(event.pointerId);
  }

  return (
    <span
      className={`edit-text ${selected ? "selected" : ""}`}
      style={{
        left: `${text.xPct}%`,
        top: `${text.yPct}%`,
        fontSize: `${text.fontPct}cqw`,
        color: text.color,
        fontWeight: text.bold ? 700 : 400,
        textAlign: text.align,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onDoubleClick={() => onDoubleClick(text.id)}
    >
      {text.content || "Texte"}
    </span>
  );
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
