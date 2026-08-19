import { useEffect, useRef, useState } from "react";
import ImageCanvas from "./components/ImageCanvas.jsx";
import SessionPanel from "./components/SessionPanel.jsx";
import SendDialog from "./components/SendDialog.jsx";
import { readFileAsDataUrl, loadImage, resizeImageDataUrl } from "./imageUtils.js";

let nextId = 1;

export default function App() {
  const [state, setState] = useState({ connected: false, sessionCodes: [], serverUrl: "" });
  const [image, setImage] = useState(null); // { dataUrl, aspectRatio }
  const [texts, setTexts] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [status, setStatus] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    window.chekssa.getState().then(setState);
    const off = window.chekssa.onStateChanged(setState);
    return off;
  }, []);

  useEffect(() => {
    if (!status) return;
    const timer = setTimeout(() => setStatus(null), 4000);
    return () => clearTimeout(timer);
  }, [status]);

  async function handlePickImage(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    const img = await loadImage(dataUrl);
    setImage({ dataUrl, aspectRatio: img.naturalWidth / img.naturalHeight });
  }

  function addText() {
    const text = {
      id: nextId++,
      content: "Nouveau texte",
      xPct: 50,
      yPct: 50,
      fontPct: 6,
      color: "#ffffff",
      bold: true,
      align: "left",
    };
    setTexts((prev) => [...prev, text]);
    setSelectedId(text.id);
  }

  function updateText(id, patch) {
    setTexts((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  function deleteText(id) {
    setTexts((prev) => prev.filter((t) => t.id !== id));
    setSelectedId(null);
  }

  async function handleJoin(code) {
    const res = await window.chekssa.joinSession(code);
    if (!res.ok) setStatus(res.error || "Impossible de rejoindre la session.");
  }

  async function handleLeave(code) {
    await window.chekssa.leaveSession(code);
  }

  function handleSendClick() {
    if (!image) {
      setStatus("Ajoutez une image avant d'envoyer.");
      return;
    }
    if (state.sessionCodes.length === 0) {
      setStatus("Rejoignez au moins une session avant d'envoyer.");
      return;
    }
    if (state.sessionCodes.length === 1) {
      doSend(state.sessionCodes);
    } else {
      setSendDialogOpen(true);
    }
  }

  async function doSend(codes) {
    setSendDialogOpen(false);
    setStatus("Envoi en cours…");
    const compressed = await resizeImageDataUrl(image.dataUrl);
    const payload = {
      codes,
      imageDataUrl: compressed,
      imageAspectRatio: image.aspectRatio,
      texts,
    };
    const res = await window.chekssa.sendBroadcast(payload);
    setStatus(res.ok ? `Envoyé à : ${codes.join(", ")}` : "Échec de l'envoi.");
  }

  const selectedText = texts.find((t) => t.id === selectedId) || null;

  return (
    <div className="app">
      <aside className="sidebar">
        <h1>Chekssa</h1>
        <SessionPanel
          connected={state.connected}
          sessionCodes={state.sessionCodes}
          onJoin={handleJoin}
          onLeave={handleLeave}
        />

        <div className="toolbox">
          <h2>Composer</h2>
          <button type="button" onClick={() => fileInputRef.current?.click()}>
            Ajouter une image
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePickImage}
            style={{ display: "none" }}
          />
          <button type="button" onClick={addText} disabled={!image}>
            Ajouter un texte
          </button>
        </div>

        {selectedText && (
          <div className="text-editor">
            <h2>Texte sélectionné</h2>
            <textarea
              value={selectedText.content}
              onChange={(e) => updateText(selectedText.id, { content: e.target.value })}
              rows={2}
            />
            <label>
              Taille
              <input
                type="range"
                min={2}
                max={14}
                step={0.5}
                value={selectedText.fontPct}
                onChange={(e) => updateText(selectedText.id, { fontPct: Number(e.target.value) })}
              />
            </label>
            <label>
              Couleur
              <input
                type="color"
                value={selectedText.color}
                onChange={(e) => updateText(selectedText.id, { color: e.target.value })}
              />
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={selectedText.bold}
                onChange={(e) => updateText(selectedText.id, { bold: e.target.checked })}
              />
              Gras
            </label>
            <button type="button" className="danger" onClick={() => deleteText(selectedText.id)}>
              Supprimer ce texte
            </button>
          </div>
        )}

        <button type="button" className="send-button primary" onClick={handleSendClick}>
          Envoyer
        </button>
        {status && <p className="status">{status}</p>}
      </aside>

      <main className="canvas-area">
        <ImageCanvas
          image={image}
          texts={texts}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onMove={updateText}
          onDeselect={() => setSelectedId(null)}
        />
      </main>

      {sendDialogOpen && (
        <SendDialog sessionCodes={state.sessionCodes} onCancel={() => setSendDialogOpen(false)} onConfirm={doSend} />
      )}
    </div>
  );
}
