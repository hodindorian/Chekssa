import { useRef } from "react";

const MIN_WIDTH_PCT = 8;
const DEFAULT_WIDTH_PCT = 30;

export default function TextLayer({ text, containerRef, selected, onSelect, onMove, onDoubleClick }) {
  const drag = useRef(null);

  function beginDrag(mode, event) {
    event.stopPropagation();
    onSelect(text.id);
    drag.current = { mode, rightPct: text.xPct + (text.widthPct ?? DEFAULT_WIDTH_PCT) };
    event.target.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event) {
    if (!drag.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const px = clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100);
    const py = clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100);
    const { mode, rightPct } = drag.current;

    if (mode === "move") {
      onMove(text.id, { xPct: px, yPct: py });
    } else if (mode === "e") {
      const widthPct = clamp(px - text.xPct, MIN_WIDTH_PCT, 100 - text.xPct);
      onMove(text.id, { widthPct });
    } else if (mode === "w") {
      const xPct = clamp(px, 0, rightPct - MIN_WIDTH_PCT);
      onMove(text.id, { xPct, widthPct: rightPct - xPct });
    }
  }

  function endDrag(event) {
    drag.current = null;
    event.target.releasePointerCapture?.(event.pointerId);
  }

  return (
    <div
      className={`edit-text-box ${selected ? "selected" : ""}`}
      style={{
        left: `${text.xPct}%`,
        top: `${text.yPct}%`,
        width: `${text.widthPct ?? DEFAULT_WIDTH_PCT}%`,
      }}
      onPointerDown={(event) => beginDrag("move", event)}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onDoubleClick={() => onDoubleClick(text.id)}
    >
      <span
        className="edit-text"
        style={{
          fontSize: `${text.fontPct}cqw`,
          color: text.color,
          fontWeight: text.bold ? 700 : 400,
          textAlign: text.align,
        }}
      >
        {text.content || "Texte"}
      </span>
      {selected && (
        <>
          <span
            className="resize-handle handle-w"
            onPointerDown={(event) => beginDrag("w", event)}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
          />
          <span
            className="resize-handle handle-e"
            onPointerDown={(event) => beginDrag("e", event)}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
          />
        </>
      )}
    </div>
  );
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
