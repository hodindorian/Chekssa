import { useEffect, useRef, useState } from "react";

// Tenor's API was shut down by Google (no new clients since Jan 2026, third-party
// access ended June 2026). Klipy is the drop-in-ish replacement recommended by the
// community; its API key lives in the URL path rather than a query param.
const KLIPY_BASE = "https://api.klipy.com/api/v1";
// The overlay popup only ever renders at 340-640px wide, so "hd" gifs (which
// can run several MB) are wasted weight - "md" is the best size/quality
// trade-off, with "hd" only as a last-resort fallback if smaller sizes are
// missing. A hard cap avoids the socket "transport close" that Engine.IO
// throws when a message exceeds the server's maxHttpBufferSize.
const MAX_GIF_MB = 8;

export default function GifPicker({ apiKey, customerId, onSaveApiKey, onSelect, onCancel }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [keyInput, setKeyInput] = useState(apiKey || "");
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!apiKey) return undefined;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 350);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, apiKey]);

  async function search(q) {
    setLoading(true);
    setError(null);
    try {
      const trimmed = q.trim();
      const params = new URLSearchParams({
        per_page: "24",
        page: "1",
        customer_id: customerId || "chekssa",
        content_filter: "medium",
        format_filter: "gif",
      });
      if (trimmed) params.set("q", trimmed);
      const endpoint = trimmed ? "search" : "trending";
      const res = await fetch(`${KLIPY_BASE}/${encodeURIComponent(apiKey)}/gifs/${endpoint}?${params.toString()}`);
      if (!res.ok) throw new Error(`Klipy a répondu ${res.status}`);
      const data = await res.json();
      if (data.result === false) throw new Error(data.message || "Clé API invalide.");
      setResults(data.data?.data || []);
    } catch (err) {
      setError(err.message || "Recherche impossible.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  async function pick(result) {
    const gif = result.file?.md?.gif || result.file?.sm?.gif || result.file?.hd?.gif;
    if (!gif) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(gif.url);
      if (!res.ok) throw new Error("Téléchargement impossible.");
      const blob = await res.blob();
      if (blob.size > MAX_GIF_MB * 1024 * 1024) {
        setError(`Ce GIF est trop volumineux pour être envoyé (${(blob.size / 1024 / 1024).toFixed(1)} Mo, max ${MAX_GIF_MB} Mo). Essaie-en un autre.`);
        return;
      }
      onSelect(blob, gif.width && gif.height ? gif.width / gif.height : 1);
    } catch {
      setError("Impossible de récupérer ce GIF.");
    } finally {
      setLoading(false);
    }
  }

  function saveKey(event) {
    event.preventDefault();
    if (!keyInput.trim()) return;
    onSaveApiKey(keyInput.trim());
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal gif-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Chercher un GIF (Klipy)</h3>

        {!apiKey ? (
          <form onSubmit={saveKey} className="gif-key-form">
            <p className="hint">
              Une clé API Klipy gratuite est nécessaire.{" "}
              <a href="https://partner.klipy.com/api-keys" target="_blank" rel="noreferrer">
                Obtenir une clé
              </a>
            </p>
            <input
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="Clé API Klipy"
              autoFocus
            />
            <div className="modal-actions">
              <button type="button" onClick={onCancel}>
                Annuler
              </button>
              <button type="submit" className="primary" disabled={!keyInput.trim()}>
                Enregistrer
              </button>
            </div>
          </form>
        ) : (
          <>
            <input
              autoFocus
              className="gif-search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un GIF…"
            />
            {error && <p className="connection-error">{error}</p>}
            <div className="gif-grid">
              {results.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className="gif-item"
                  onClick={() => pick(r)}
                  title={r.title}
                  disabled={loading}
                >
                  <img src={r.file?.sm?.gif?.url} alt="" loading="lazy" />
                </button>
              ))}
              {!loading && results.length === 0 && <p className="hint">Aucun résultat.</p>}
            </div>
            {loading && <p className="hint">Chargement…</p>}
            <div className="modal-actions">
              <button type="button" onClick={onCancel}>
                Fermer
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
