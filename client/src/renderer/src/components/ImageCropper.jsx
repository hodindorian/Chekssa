import { useEffect, useRef, useState } from "react";
import { loadImage } from "../imageUtils.js";

const MAX_BOX_WIDTH = 560;
const MAX_BOX_HEIGHT = 420;
const MIN_CROP_FRACTION = 0.1;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export default function ImageCropper({ dataUrl, onConfirm, onCancel }) {
  const [imgSize, setImgSize] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0, width: 1, height: 1 });
  const imgRef = useRef(null);
  const dragRef = useRef(null);
  const boxRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setImgSize(null);
    setCrop({ x: 0, y: 0, width: 1, height: 1 });
    loadImage(dataUrl).then((img) => {
      if (cancelled) return;
      imgRef.current = img;
      setImgSize({ width: img.naturalWidth, height: img.naturalHeight });
    });
    return () => {
      cancelled = true;
    };
  }, [dataUrl]);

  function beginDrag(mode, event) {
    event.stopPropagation();
    dragRef.current = { mode, startClientX: event.clientX, startClientY: event.clientY, start: crop };
    event.target.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event) {
    const drag = dragRef.current;
    if (!drag || !boxRef.current) return;
    const rect = boxRef.current.getBoundingClientRect();
    const dxPct = (event.clientX - drag.startClientX) / rect.width;
    const dyPct = (event.clientY - drag.startClientY) / rect.height;
    const { mode, start } = drag;

    if (mode === "move") {
      setCrop({
        ...start,
        x: clamp(start.x + dxPct, 0, 1 - start.width),
        y: clamp(start.y + dyPct, 0, 1 - start.height),
      });
      return;
    }

    let { x, y, width, height } = start;
    if (mode.includes("e")) width = clamp(start.width + dxPct, MIN_CROP_FRACTION, 1 - start.x);
    if (mode.includes("w")) {
      const right = start.x + start.width;
      x = clamp(start.x + dxPct, 0, right - MIN_CROP_FRACTION);
      width = right - x;
    }
    if (mode.includes("s")) height = clamp(start.height + dyPct, MIN_CROP_FRACTION, 1 - start.y);
    if (mode.includes("n")) {
      const bottom = start.y + start.height;
      y = clamp(start.y + dyPct, 0, bottom - MIN_CROP_FRACTION);
      height = bottom - y;
    }
    setCrop({ x, y, width, height });
  }

  function endDrag(event) {
    dragRef.current = null;
    event.target.releasePointerCapture?.(event.pointerId);
  }

  function reset() {
    setCrop({ x: 0, y: 0, width: 1, height: 1 });
  }

  function confirm() {
    const img = imgRef.current;
    if (!img) return;
    const sx = Math.round(crop.x * img.naturalWidth);
    const sy = Math.round(crop.y * img.naturalHeight);
    const sw = Math.round(crop.width * img.naturalWidth);
    const sh = Math.round(crop.height * img.naturalHeight);

    const canvas = document.createElement("canvas");
    canvas.width = sw;
    canvas.height = sh;
    canvas.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    onConfirm(canvas.toDataURL("image/png"), sw / sh);
  }

  const isFullCrop = crop.x === 0 && crop.y === 0 && crop.width === 1 && crop.height === 1;

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal crop-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Rogner l'image</h3>
        {imgSize ? (
          <>
            <p className="hint">
              Fais glisser le cadre pour choisir la zone à garder, ou tire ses coins pour le redimensionner.
            </p>
            <div
              ref={boxRef}
              className="crop-box"
              style={{
                width: Math.round(imgSize.width * Math.min(MAX_BOX_WIDTH / imgSize.width, MAX_BOX_HEIGHT / imgSize.height, 1)),
                height: Math.round(imgSize.height * Math.min(MAX_BOX_WIDTH / imgSize.width, MAX_BOX_HEIGHT / imgSize.height, 1)),
                backgroundImage: `url(${dataUrl})`,
              }}
            >
              <div
                className="crop-rect"
                style={{
                  left: `${crop.x * 100}%`,
                  top: `${crop.y * 100}%`,
                  width: `${crop.width * 100}%`,
                  height: `${crop.height * 100}%`,
                }}
                onPointerDown={(event) => beginDrag("move", event)}
                onPointerMove={handlePointerMove}
                onPointerUp={endDrag}
              >
                {["nw", "ne", "sw", "se"].map((corner) => (
                  <span
                    key={corner}
                    className={`crop-handle crop-handle-${corner}`}
                    onPointerDown={(event) => beginDrag(corner, event)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={endDrag}
                  />
                ))}
              </div>
            </div>
          </>
        ) : (
          <p className="hint">Chargement de l'image…</p>
        )}

        <div className="modal-actions">
          <button type="button" onClick={onCancel}>
            Annuler
          </button>
          <button type="button" onClick={reset} disabled={isFullCrop}>
            Réinitialiser
          </button>
          <button type="button" className="primary" disabled={!imgSize} onClick={confirm}>
            Rogner
          </button>
        </div>
      </div>
    </div>
  );
}
