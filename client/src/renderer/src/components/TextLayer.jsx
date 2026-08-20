import { useEffect, useRef, useState } from "react";

const MIN_WIDTH_PCT = 8;
const DEFAULT_WIDTH_PCT = 30;

export default function TextLayer({ text, containerRef, selected, onSelect, onMove, onDoubleClick }) {
  const drag = useRef(null);
  const [editing, setEditing] = useState(false);
  const editRef = useRef(null);

  useEffect(() => {
    if (editing) {
      editRef.current?.focus();
      editRef.current?.select();
      autosize(editRef.current);
    }
  }, [editing]);

  function beginDrag(mode, event) {
    if (editing) return;
    event.stopPropagation();
    onSelect(text.id);
    if (mode === "move" && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const clickXPct = ((event.clientX - rect.left) / rect.width) * 100;
      const clickYPct = ((event.clientY - rect.top) / rect.height) * 100;
      // Grab offset from where the box actually is, not its top-left corner -
      // otherwise the box jumps to snap its corner under the cursor instead
      // of following the point that was clicked.
      drag.current = { mode, offsetXPct: clickXPct - text.xPct, offsetYPct: clickYPct - text.yPct };
    } else {
      drag.current = { mode, rightPct: text.xPct + (text.widthPct ?? DEFAULT_WIDTH_PCT) };
    }
    event.target.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event) {
    if (!drag.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const px = clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100);
    const py = clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100);
    const { mode, rightPct, offsetXPct, offsetYPct } = drag.current;

    if (mode === "move") {
      onMove(text.id, { xPct: clamp(px - offsetXPct, 0, 100), yPct: clamp(py - offsetYPct, 0, 100) });
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
      onDoubleClick={() => {
        onDoubleClick(text.id);
        setEditing(true);
      }}
    >
      {editing ? (
        <textarea
          ref={editRef}
          className="edit-text edit-text-input"
          style={{
            fontSize: `${text.fontPct}cqw`,
            color: text.color,
            fontWeight: text.bold ? 700 : 400,
            textAlign: text.align,
          }}
          value={text.content}
          placeholder="Texte"
          onChange={(event) => {
            onMove(text.id, { content: event.target.value });
            autosize(event.target);
          }}
          onPointerDown={(event) => event.stopPropagation()}
          onBlur={() => setEditing(false)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setEditing(false);
          }}
        />
      ) : (
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
      )}
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

// Textareas don't grow with their content like the display <span> does -
// mirror that by resizing to fit whatever's typed, same trick as any
// auto-grow textarea.
function autosize(el) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}
