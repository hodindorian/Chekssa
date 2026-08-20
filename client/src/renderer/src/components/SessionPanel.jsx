import { useState } from "react";

export default function SessionPanel({ connected, serverUrl, lastError, sessionCodes, sessionCounts, onJoin, onLeave }) {
  const [code, setCode] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    if (!code.trim()) return;
    onJoin(code);
    setCode("");
  }

  return (
    <div className="session-panel">
      <div className="session-status">
        <span className={`dot ${connected ? "dot-on" : "dot-off"}`} />
        {connected ? "Connecté" : "Déconnecté"}
        {serverUrl && <span className="server-url">({serverUrl})</span>}
      </div>

      {!connected && lastError && <p className="connection-error">Erreur : {lastError}</p>}

      <form onSubmit={handleSubmit} className="session-join-form">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Code de session"
          maxLength={32}
        />
        <button type="submit">Rejoindre</button>
      </form>

      <ul className="session-list">
        {sessionCodes.length === 0 && <li className="session-empty">Aucune session rejointe.</li>}
        {sessionCodes.map((c) => (
          <li key={c}>
            <span>
              {c}
              {sessionCounts?.[c] != null && (
                <span className="session-count" title="Personnes connectées sur cette session">
                  {" "}
                  ({sessionCounts[c]})
                </span>
              )}
            </span>
            <button type="button" onClick={() => onLeave(c)} title="Quitter">
              Quitter
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
