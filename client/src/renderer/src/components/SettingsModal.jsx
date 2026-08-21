import { useRef, useState } from "react";

const SCREEN_BOX_WIDTH = 480;
const SCREEN_BOX_HEIGHT = 270;
const NOTIF_PREVIEW_RATIO = 1.5;
const MIN_WIDTH_PCT = 0.08;
const MAX_WIDTH_PCT = 0.6;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export default function SettingsModal({
  displayName,
  onSaveDisplayName,
  overlayPosition,
  onSaveOverlayPosition,
  appVersion,
  updateStatus,
  onCheckUpdates,
  onDownloadUpdate,
  onInstallUpdate,
  onCancel,
}) {
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal settings-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Paramètres</h3>

        <section className="settings-section">
          <h4>Pseudo</h4>
          <p className="hint">Affiché aux autres quand tu envoies quelque chose.</p>
          <DisplayNameField initial={displayName} onSave={onSaveDisplayName} />
        </section>

        <section className="settings-section">
          <h4>Position des notifications</h4>
          <NotificationPositionPicker initial={overlayPosition} onSave={onSaveOverlayPosition} />
        </section>

        <section className="settings-section">
          <h4>Mises à jour</h4>
          <p className="hint">Version actuelle : v{appVersion || "…"}</p>
          <UpdateStatus
            status={updateStatus}
            onCheck={onCheckUpdates}
            onDownload={onDownloadUpdate}
            onInstall={onInstallUpdate}
          />
        </section>

        <div className="modal-actions">
          <button type="button" onClick={onCancel}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

function UpdateStatus({ status, onCheck, onDownload, onInstall }) {
  const state = status?.state || "idle";

  if (state === "idle") {
    return (
      <button type="button" onClick={onCheck}>
        Vérifier les mises à jour
      </button>
    );
  }
  if (state === "checking") {
    return <p className="hint">Recherche en cours…</p>;
  }
  if (state === "not-available") {
    return (
      <>
        <p className="hint">Tu as déjà la dernière version.</p>
        <button type="button" onClick={onCheck}>
          Revérifier
        </button>
      </>
    );
  }
  if (state === "available") {
    return (
      <>
        <p className="hint">Nouvelle version disponible : v{status.version}</p>
        <button type="button" className="primary" onClick={onDownload}>
          Mettre à jour
        </button>
      </>
    );
  }
  if (state === "downloading") {
    return <p className="hint">Téléchargement… {status.progress ?? 0}%</p>;
  }
  if (state === "downloaded") {
    return (
      <>
        <p className="hint">Mise à jour prête (v{status.version}) — redémarrage…</p>
        <button type="button" className="primary" onClick={onInstall}>
          Redémarrer maintenant
        </button>
      </>
    );
  }
  return (
    <>
      <p className="connection-error">{status.error || "Impossible de vérifier les mises à jour."}</p>
      <button type="button" onClick={onCheck}>
        Réessayer
      </button>
    </>
  );
}

function NotificationPositionPicker({ initial, onSave }) {
  const [pos, setPos] = useState(initial);
  const dragRef = useRef(null);
  const screenRef = useRef(null);

  const boxWidthPx = pos.widthPct * SCREEN_BOX_WIDTH;
  const boxHeightPx = boxWidthPx / NOTIF_PREVIEW_RATIO;
  const heightPct = boxHeightPx / SCREEN_BOX_HEIGHT;

  function beginMove(event) {
    event.stopPropagation();
    dragRef.current = {
      mode: "move",
      startClientX: event.clientX,
      startClientY: event.clientY,
      startXPct: pos.xPct,
      startYPct: pos.yPct,
    };
    event.target.setPointerCapture(event.pointerId);
  }

  function beginResize(event) {
    event.stopPropagation();
    dragRef.current = { mode: "resize", startClientX: event.clientX, startWidthPct: pos.widthPct };
    event.target.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event) {
    const drag = dragRef.current;
    if (!drag || !screenRef.current) return;
    const rect = screenRef.current.getBoundingClientRect();

    if (drag.mode === "move") {
      const dxPct = (event.clientX - drag.startClientX) / rect.width;
      const dyPct = (event.clientY - drag.startClientY) / rect.height;
      setPos((p) => ({
        ...p,
        xPct: clamp(drag.startXPct + dxPct, 0, 1 - p.widthPct),
        yPct: clamp(drag.startYPct + dyPct, 0, 1 - heightPct),
      }));
    } else {
      const dxPct = (event.clientX - drag.startClientX) / rect.width;
      setPos((p) => {
        const widthPct = clamp(drag.startWidthPct + dxPct, MIN_WIDTH_PCT, MAX_WIDTH_PCT);
        const newHeightPct = (widthPct * SCREEN_BOX_WIDTH) / NOTIF_PREVIEW_RATIO / SCREEN_BOX_HEIGHT;
        return {
          ...p,
          widthPct,
          xPct: Math.min(p.xPct, 1 - widthPct),
          yPct: Math.min(p.yPct, 1 - newHeightPct),
        };
      });
    }
  }

  function endDrag(event) {
    dragRef.current = null;
    event.target.releasePointerCapture?.(event.pointerId);
    onSave(pos);
  }

  return (
    <>
      <p className="hint">
        Fais glisser le rectangle pour choisir où les memes reçus s'affichent sur ton écran. Tire le coin en bas à
        droite pour changer sa taille.
      </p>
      <div ref={screenRef} className="screen-preview" style={{ width: SCREEN_BOX_WIDTH, height: SCREEN_BOX_HEIGHT }}>
        <div
          className="notif-preview"
          style={{
            left: `${pos.xPct * 100}%`,
            top: `${pos.yPct * 100}%`,
            width: boxWidthPx,
            height: boxHeightPx,
          }}
          onPointerDown={beginMove}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
        >
          <span
            className="notif-resize-handle"
            onPointerDown={beginResize}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
          />
        </div>
      </div>
    </>
  );
}

function DisplayNameField({ initial, onSave }) {
  const [value, setValue] = useState(initial || "");

  function handleSubmit(event) {
    event.preventDefault();
    onSave(value);
  }

  return (
    <form onSubmit={handleSubmit} className="session-join-form">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => onSave(value)}
        placeholder="Ton pseudo"
        maxLength={32}
      />
      <button type="submit">Enregistrer</button>
    </form>
  );
}
