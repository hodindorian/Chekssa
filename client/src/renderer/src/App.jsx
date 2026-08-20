import { useEffect, useRef, useState } from "react";
import ImageCanvas from "./components/ImageCanvas.jsx";
import SessionPanel from "./components/SessionPanel.jsx";
import SendDialog from "./components/SendDialog.jsx";
import GifPicker from "./components/GifPicker.jsx";
import VideoLinkPicker from "./components/VideoLinkPicker.jsx";
import LocalVideoPicker from "./components/LocalVideoPicker.jsx";
import SettingsModal from "./components/SettingsModal.jsx";
import { readFileAsDataUrl, loadImage, resizeImageDataUrl } from "./imageUtils.js";
import logo from "./assets/logo.png";

let nextId = 1;

// Matches an <img> src or a bare URL ending in .gif inside pasted HTML/text,
// so we can fetch the original animated file instead of the flattened
// static bitmap most apps put on the OS clipboard for "copy image".
const GIF_URL_RE = /https?:\/\/[^\s"'<>]+\.gif(\?[^\s"'<>]*)?/i;
// Keep in step with the same guard in GifPicker.jsx.
const MAX_GIF_MB = 40;
const MAX_IMAGE_DISPLAY_MS = 10000;
// Must match .sidebar's top+bottom padding in App.css.
const SIDEBAR_VERTICAL_PADDING = 36;
const THEME_STORAGE_KEY = "chekssa-theme";

export default function App() {
  const [state, setState] = useState({ connected: false, sessionCodes: [], sessionCounts: {}, serverUrl: "" });
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_STORAGE_KEY) || "dark");
  // { kind: "image", dataUrl, aspectRatio, isAnimated } | { kind: "youtube", videoId, start, end, aspectRatio }
  const [media, setMedia] = useState(null);
  const [texts, setTexts] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [gifPickerOpen, setGifPickerOpen] = useState(false);
  const [videoLinkPickerOpen, setVideoLinkPickerOpen] = useState(false);
  const [localVideoPickerOpen, setLocalVideoPickerOpen] = useState(false);
  const [klipyApiKey, setKlipyApiKey] = useState("");
  const [klipyCustomerId, setKlipyCustomerId] = useState("");
  const [overlayPosition, setOverlayPosition] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [appVersion, setAppVersion] = useState("");
  const [updateStatus, setUpdateStatus] = useState(null);
  const [status, setStatus] = useState(null);
  const fileInputRef = useRef(null);
  const sidebarContentRef = useRef(null);

  useEffect(() => {
    window.chekssa.getState().then(setState);
    const off = window.chekssa.onStateChanged(setState);
    return off;
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }

  useEffect(() => {
    window.chekssa.getSettings().then((s) => {
      setKlipyApiKey(s.klipyApiKey || "");
      setKlipyCustomerId(s.klipyCustomerId || "");
      setOverlayPosition(s.overlayPosition || { xPct: 0.72, yPct: 0.02, widthPct: 0.18 });
    });
  }, []);

  async function handleSaveOverlayPosition(position) {
    const saved = await window.chekssa.setOverlayPosition(position);
    setOverlayPosition(saved);
  }

  useEffect(() => {
    window.chekssa.getAppVersion().then(setAppVersion);
  }, []);

  useEffect(() => {
    return window.chekssa.onUpdateStatus((next) => {
      setUpdateStatus(next);
      // Surface the automatic startup check even when Settings isn't open -
      // otherwise a user who never opens the gear icon would never know.
      if (next.state === "available") {
        setStatus(`Une nouvelle version (v${next.version}) est disponible. Ouvre les paramètres pour l'installer.`);
      }
      // "Un clic pour mettre à jour" - once the download finishes, install
      // and restart automatically instead of making the user click twice.
      if (next.state === "downloaded") {
        window.chekssa.installUpdate();
      }
    });
  }, []);

  function handleCheckUpdates() {
    window.chekssa.checkForUpdates();
  }

  function handleDownloadUpdate() {
    window.chekssa.downloadUpdate();
  }

  function handleInstallUpdate() {
    window.chekssa.installUpdate();
  }

  useEffect(() => {
    if (!status) return;
    const timer = setTimeout(() => setStatus(null), 4000);
    return () => clearTimeout(timer);
  }, [status]);

  // The sidebar itself is stretched to the window's full height, so
  // scrolling was the only way to reach content taller than the window -
  // instead grow/shrink the actual window to fit the sidebar's real content
  // height (measured on an unstretched inner wrapper, see .sidebar-content).
  useEffect(() => {
    const el = sidebarContentRef.current;
    if (!el) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      window.chekssa.setWindowContentHeight(entry.contentRect.height + SIDEBAR_VERTICAL_PADDING);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    function handlePaste(event) {
      const dt = event.clipboardData;
      if (!dt) return;

      const fileItem = [...dt.items].find((item) => item.kind === "file" && item.type.startsWith("image/"));
      const html = dt.getData("text/html");
      const plain = dt.getData("text/plain");
      const gifUrl = (html && html.match(GIF_URL_RE)?.[0]) || (plain && plain.trim().match(GIF_URL_RE)?.[0]);

      if (!fileItem && !gifUrl) return; // let normal text paste (e.g. into a textarea) proceed
      event.preventDefault();
      importPastedImage({ fileItem, gifUrl });
    }
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  async function importPastedImage({ fileItem, gifUrl }) {
    // Prefer the original GIF URL when we have one: pasted "copy image" bitmaps
    // are usually a static PNG snapshot that lost the animation.
    if (gifUrl) {
      try {
        const res = await fetch(gifUrl);
        if (res.ok) {
          const blob = await res.blob();
          await setImageFromBlob(blob, true);
          return;
        }
      } catch {
        // CORS or network failure - fall back to the clipboard bitmap below.
      }
    }
    const file = fileItem?.getAsFile();
    if (file) {
      await setImageFromBlob(file, file.type === "image/gif");
      return;
    }
    setStatus("Impossible de coller cette image.");
  }

  async function setImageFromBlob(blob, isAnimated) {
    // Animated GIFs are sent as-is (resizing would freeze the animation), so
    // unlike static images they can't be shrunk before hitting the socket's
    // size limit - catch it here instead of a cryptic "transport close".
    if (isAnimated && blob.size > MAX_GIF_MB * 1024 * 1024) {
      setStatus(`Ce GIF est trop volumineux pour être envoyé (${(blob.size / 1024 / 1024).toFixed(1)} Mo, max ${MAX_GIF_MB} Mo).`);
      return;
    }
    const dataUrl = await readFileAsDataUrl(blob);
    const img = await loadImage(dataUrl);
    setMedia({
      kind: "image",
      dataUrl,
      aspectRatio: img.naturalWidth / img.naturalHeight,
      isAnimated,
      durationMs: MAX_IMAGE_DISPLAY_MS,
    });
  }

  async function handlePickImage(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    await setImageFromBlob(file, file.type === "image/gif");
  }

  async function handleGifPicked(blob, aspectRatio) {
    const dataUrl = await readFileAsDataUrl(blob);
    setMedia({ kind: "image", dataUrl, aspectRatio, isAnimated: true, durationMs: MAX_IMAGE_DISPLAY_MS });
    setGifPickerOpen(false);
  }

  function updateMedia(patch) {
    setMedia((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  function handleVideoLinkInserted(videoMedia) {
    setMedia(videoMedia);
    setVideoLinkPickerOpen(false);
  }

  function handleLocalVideoInserted(videoMedia) {
    setMedia(videoMedia);
    setLocalVideoPickerOpen(false);
  }

  async function handleSaveKlipyKey(key) {
    const saved = await window.chekssa.setKlipyApiKey(key);
    setKlipyApiKey(saved);
  }

  function addText() {
    const text = {
      id: nextId++,
      content: "Nouveau texte",
      xPct: 35,
      yPct: 45,
      widthPct: 30,
      fontPct: 6,
      color: "#ffffff",
      bold: true,
      align: "center",
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
    if (!media) {
      setStatus("Ajoutez une image, un GIF ou une vidéo avant d'envoyer.");
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
    let mediaPayload;
    if (media.kind === "image") {
      // GIFs go through as-is: resizing them draws a single frame onto a canvas,
      // which would freeze the animation for recipients.
      const dataUrl = media.isAnimated ? media.dataUrl : await resizeImageDataUrl(media.dataUrl);
      mediaPayload = {
        kind: "image",
        dataUrl,
        aspectRatio: media.aspectRatio,
        isAnimated: media.isAnimated,
        durationMs: Math.min(media.durationMs || MAX_IMAGE_DISPLAY_MS, MAX_IMAGE_DISPLAY_MS),
      };
    } else {
      // Video kinds (youtube/tiktok/twitter/local-video) go through as-is.
      mediaPayload = media;
    }
    const payload = { codes, media: mediaPayload, texts };
    const res = await window.chekssa.sendBroadcast(payload);
    setStatus(res.ok ? `Envoyé à : ${codes.join(", ")}` : "Échec de l'envoi.");
  }

  const selectedText = texts.find((t) => t.id === selectedId) || null;

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-content" ref={sidebarContentRef}>
          <div className="app-brand">
            <img src={logo} alt="" className="app-logo" />
            <h1>Chekssa</h1>
            <div className="brand-actions">
              <button
                type="button"
                className="theme-toggle"
                onClick={() => setSettingsOpen(true)}
                title="Paramètres"
              >
                ⚙️
              </button>
              <button
                type="button"
                className="theme-toggle"
                onClick={toggleTheme}
                title={theme === "dark" ? "Passer en thème clair" : "Passer en thème sombre"}
              >
                {theme === "dark" ? "☀️" : "🌙"}
              </button>
            </div>
          </div>
          <SessionPanel
            connected={state.connected}
            serverUrl={state.serverUrl}
            lastError={state.lastError}
            sessionCodes={state.sessionCodes}
            sessionCounts={state.sessionCounts}
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
            <button type="button" onClick={() => setGifPickerOpen(true)}>
              Chercher un GIF
            </button>
            <button type="button" onClick={() => setVideoLinkPickerOpen(true)}>
              Ajouter une vidéo (lien)
            </button>
            <button type="button" onClick={() => setLocalVideoPickerOpen(true)}>
              Ajouter une vidéo locale
            </button>
            <button type="button" onClick={addText} disabled={!media}>
              Ajouter un texte
            </button>
            <p className="hint">Astuce : Ctrl+V colle directement une image ou un GIF copié.</p>
            <p className="hint">Liens vidéo supportés : YouTube, TikTok, X/Twitter.</p>
          </div>

          {media?.kind === "image" && (
            <div className="text-editor">
              <h2>Durée d'affichage</h2>
              <label>
                <span className="nowrap">{((media.durationMs ?? MAX_IMAGE_DISPLAY_MS) / 1000).toFixed(1)}s</span>
                <input
                  type="range"
                  min={1000}
                  max={MAX_IMAGE_DISPLAY_MS}
                  step={500}
                  value={media.durationMs ?? MAX_IMAGE_DISPLAY_MS}
                  onChange={(e) => updateMedia({ durationMs: Number(e.target.value) })}
                />
              </label>
            </div>
          )}

          <button type="button" className="send-button primary" onClick={handleSendClick}>
            Envoyer
          </button>
        </div>
      </aside>

      {selectedText && (
        <aside className="text-panel">
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
            <div className="align-group">
              {[
                ["left", "Gauche"],
                ["center", "Centre"],
                ["right", "Droite"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={selectedText.align === value ? "primary" : ""}
                  onClick={() => updateText(selectedText.id, { align: value })}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="hint">Glissez le texte pour le déplacer, ou ses bords gauche/droit pour changer sa largeur.</p>
            <button type="button" className="danger" onClick={() => deleteText(selectedText.id)}>
              Supprimer ce texte
            </button>
          </div>
        </aside>
      )}

      {status && <p className="status status-toast">{status}</p>}

      <main className="canvas-area">
        <ImageCanvas
          media={media}
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

      {gifPickerOpen && (
        <GifPicker
          apiKey={klipyApiKey}
          customerId={klipyCustomerId}
          onSaveApiKey={handleSaveKlipyKey}
          onSelect={handleGifPicked}
          onCancel={() => setGifPickerOpen(false)}
        />
      )}

      {videoLinkPickerOpen && (
        <VideoLinkPicker onInsert={handleVideoLinkInserted} onCancel={() => setVideoLinkPickerOpen(false)} />
      )}

      {localVideoPickerOpen && (
        <LocalVideoPicker onInsert={handleLocalVideoInserted} onCancel={() => setLocalVideoPickerOpen(false)} />
      )}

      {settingsOpen && overlayPosition && (
        <SettingsModal
          overlayPosition={overlayPosition}
          onSaveOverlayPosition={handleSaveOverlayPosition}
          appVersion={appVersion}
          updateStatus={updateStatus}
          onCheckUpdates={handleCheckUpdates}
          onDownloadUpdate={handleDownloadUpdate}
          onInstallUpdate={handleInstallUpdate}
          onCancel={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
