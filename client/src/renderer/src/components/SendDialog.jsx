import { useState } from "react";

export default function SendDialog({ sessionCodes, onCancel, onConfirm }) {
  const [selected, setSelected] = useState(new Set(sessionCodes));

  function toggle(code) {
    const next = new Set(selected);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setSelected(next);
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Envoyer à quelle(s) session(s) ?</h3>
        <ul className="modal-session-list">
          {sessionCodes.map((code) => (
            <li key={code}>
              <label>
                <input type="checkbox" checked={selected.has(code)} onChange={() => toggle(code)} />
                {code}
              </label>
            </li>
          ))}
        </ul>
        <div className="modal-actions">
          <button type="button" onClick={onCancel}>
            Annuler
          </button>
          <button type="button" className="primary" disabled={selected.size === 0} onClick={() => onConfirm([...selected])}>
            Envoyer
          </button>
        </div>
      </div>
    </div>
  );
}
