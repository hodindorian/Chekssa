import { useState } from "react";

export default function SessionPanel({ connected, sessionCodes, onJoin, onLeave }) {
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
        {connected ? "Connecté au serveur" : "Déconnecté"}
      </div>

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
