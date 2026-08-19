import { useState } from "react";

export default function SessionPanel({ connected, serverUrl, lastError, sessionCodes, onJoin, onLeave, onSetServerUrl }) {
  const [code, setCode] = useState("");
  const [editingServer, setEditingServer] = useState(false);
  const [serverInput, setServerInput] = useState(serverUrl || "");

  function handleSubmit(event) {
    event.preventDefault();
    if (!code.trim()) return;
    onJoin(code);
    setCode("");
  }

  function startEditingServer() {
    setServerInput(serverUrl || "");
    setEditingServer(true);
  }

  function handleServerSubmit(event) {
    event.preventDefault();
    if (!serverInput.trim()) return;
    onSetServerUrl(serverInput.trim());
    setEditingServer(false);
  }

  return (
    <div className="session-panel">
      <div className="session-status">
        <span className={`dot ${connected ? "dot-on" : "dot-off"}`} />
        {connected ? "Connecté" : "Déconnecté"}
        {!editingServer && serverUrl && <span className="server-url">({serverUrl})</span>}
        {!editingServer && (
          <button type="button" className="link-button" onClick={startEditingServer}>
            Changer
          </button>
        )}
      </div>

      {editingServer && (
        <form onSubmit={handleServerSubmit} className="session-join-form">
          <input
            value={serverInput}
            onChange={(e) => setServerInput(e.target.value)}
            placeholder="https://chekssa.hodindorian.com"
          />
          <button type="submit">Valider</button>
          <button type="button" onClick={() => setEditingServer(false)}>
            Annuler
          </button>
        </form>
      )}

      {!connected && lastError && <p className="connection-error">Erreur : {lastError}</p>}

      <form onSubmit={handleSubmit} className="session-join-form">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Code de session (ex: EQUIPE1)"
          maxLength={32}
        />
        <button type="submit">Rejoindre</button>
      </form>

      <ul className="session-list">
        {sessionCodes.length === 0 && <li className="session-empty">Aucune session rejointe.</li>}
        {sessionCodes.map((c) => (
          <li key={c}>
            <span>{c}</span>
            <button type="button" onClick={() => onLeave(c)} title="Quitter">
              Quitter
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
