import { r as reactExports, j as jsxRuntimeExports, R as ReactDOM, a as React } from "./client-DSTAIts0.js";
const MIN_WIDTH_PCT = 8;
const DEFAULT_WIDTH_PCT = 30;
function TextLayer({ text, containerRef, selected, onSelect, onMove, onDoubleClick }) {
  const drag = reactExports.useRef(null);
  function beginDrag(mode, event) {
    event.stopPropagation();
    onSelect(text.id);
    drag.current = { mode, rightPct: text.xPct + (text.widthPct ?? DEFAULT_WIDTH_PCT) };
    event.target.setPointerCapture(event.pointerId);
  }
  function handlePointerMove(event) {
    if (!drag.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const px = clamp((event.clientX - rect.left) / rect.width * 100, 0, 100);
    const py = clamp((event.clientY - rect.top) / rect.height * 100, 0, 100);
    const { mode, rightPct } = drag.current;
    if (mode === "move") {
      onMove(text.id, { xPct: px, yPct: py });
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
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "div",
    {
      className: `edit-text-box ${selected ? "selected" : ""}`,
      style: {
        left: `${text.xPct}%`,
        top: `${text.yPct}%`,
        width: `${text.widthPct ?? DEFAULT_WIDTH_PCT}%`
      },
      onPointerDown: (event) => beginDrag("move", event),
      onPointerMove: handlePointerMove,
      onPointerUp: endDrag,
      onDoubleClick: () => onDoubleClick(text.id),
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "span",
          {
            className: "edit-text",
            style: {
              fontSize: `${text.fontPct}cqw`,
              color: text.color,
              fontWeight: text.bold ? 700 : 400,
              textAlign: text.align
            },
            children: text.content || "Texte"
          }
        ),
        selected && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "span",
            {
              className: "resize-handle handle-w",
              onPointerDown: (event) => beginDrag("w", event),
              onPointerMove: handlePointerMove,
              onPointerUp: endDrag
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "span",
            {
              className: "resize-handle handle-e",
              onPointerDown: (event) => beginDrag("e", event),
              onPointerMove: handlePointerMove,
              onPointerUp: endDrag
            }
          )
        ] })
      ]
    }
  );
}
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
function ImageCanvas({ media, texts, selectedId, onSelect, onMove, onDeselect }) {
  const containerRef = reactExports.useRef(null);
  if (!media) {
    return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "canvas-empty", children: /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: "Ajoutez une image, un GIF ou un extrait YouTube pour commencer." }) });
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "div",
    {
      ref: containerRef,
      className: "canvas-wrap",
      style: { aspectRatio: media.aspectRatio },
      onPointerDown: onDeselect,
      children: [
        media.kind === "youtube" ? /* @__PURE__ */ jsxRuntimeExports.jsx(
          "iframe",
          {
            className: "canvas-youtube",
            src: `https://www.youtube.com/embed/${media.videoId}?start=${media.start}&end=${media.end}&controls=1&modestbranding=1&rel=0&playsinline=1`,
            title: "Extrait YouTube",
            allow: "encrypted-media",
            frameBorder: "0"
          }
        ) : /* @__PURE__ */ jsxRuntimeExports.jsx("img", { src: media.dataUrl, alt: "", draggable: false }),
        texts.map((t) => /* @__PURE__ */ jsxRuntimeExports.jsx(
          TextLayer,
          {
            text: t,
            containerRef,
            selected: t.id === selectedId,
            onSelect,
            onMove,
            onDoubleClick: onSelect
          },
          t.id
        ))
      ]
    }
  );
}
function SessionPanel({ connected, serverUrl, lastError, sessionCodes, onJoin, onLeave }) {
  const [code, setCode] = reactExports.useState("");
  function handleSubmit(event) {
    event.preventDefault();
    if (!code.trim()) return;
    onJoin(code);
    setCode("");
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "session-panel", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "session-status", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: `dot ${connected ? "dot-on" : "dot-off"}` }),
      connected ? "Connecté" : "Déconnecté",
      serverUrl && /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "server-url", children: [
        "(",
        serverUrl,
        ")"
      ] })
    ] }),
    !connected && lastError && /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "connection-error", children: [
      "Erreur : ",
      lastError
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("form", { onSubmit: handleSubmit, className: "session-join-form", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "input",
        {
          value: code,
          onChange: (e) => setCode(e.target.value),
          placeholder: "Code de session (ex: EQUIPE1)",
          maxLength: 32
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "submit", children: "Rejoindre" })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("ul", { className: "session-list", children: [
      sessionCodes.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("li", { className: "session-empty", children: "Aucune session rejointe." }),
      sessionCodes.map((c) => /* @__PURE__ */ jsxRuntimeExports.jsxs("li", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: c }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: () => onLeave(c), title: "Quitter", children: "Quitter" })
      ] }, c))
    ] })
  ] });
}
function SendDialog({ sessionCodes, onCancel, onConfirm }) {
  const [selected, setSelected] = reactExports.useState(new Set(sessionCodes));
  function toggle(code) {
    const next = new Set(selected);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setSelected(next);
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "modal-backdrop", onClick: onCancel, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "modal", onClick: (e) => e.stopPropagation(), children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { children: "Envoyer à quelle(s) session(s) ?" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("ul", { className: "modal-session-list", children: sessionCodes.map((code) => /* @__PURE__ */ jsxRuntimeExports.jsx("li", { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "checkbox", checked: selected.has(code), onChange: () => toggle(code) }),
      code
    ] }) }, code)) }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "modal-actions", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: onCancel, children: "Annuler" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", className: "primary", disabled: selected.size === 0, onClick: () => onConfirm([...selected]), children: "Envoyer" })
    ] })
  ] }) });
}
const KLIPY_BASE = "https://api.klipy.com/api/v1";
function GifPicker({ apiKey, customerId, onSaveApiKey, onSelect, onCancel }) {
  const [query, setQuery] = reactExports.useState("");
  const [results, setResults] = reactExports.useState([]);
  const [loading, setLoading] = reactExports.useState(false);
  const [error, setError] = reactExports.useState(null);
  const [keyInput, setKeyInput] = reactExports.useState(apiKey || "");
  const debounceRef = reactExports.useRef(null);
  reactExports.useEffect(() => {
    if (!apiKey) return void 0;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 350);
    return () => clearTimeout(debounceRef.current);
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
        format_filter: "gif"
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
    const gif = result.file?.hd?.gif || result.file?.md?.gif || result.file?.sm?.gif;
    if (!gif) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(gif.url);
      if (!res.ok) throw new Error("Téléchargement impossible.");
      const blob = await res.blob();
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
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "modal-backdrop", onClick: onCancel, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "modal gif-modal", onClick: (e) => e.stopPropagation(), children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { children: "Chercher un GIF (Klipy)" }),
    !apiKey ? /* @__PURE__ */ jsxRuntimeExports.jsxs("form", { onSubmit: saveKey, className: "gif-key-form", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "hint", children: [
        "Une clé API Klipy gratuite est nécessaire.",
        " ",
        /* @__PURE__ */ jsxRuntimeExports.jsx("a", { href: "https://partner.klipy.com/api-keys", target: "_blank", rel: "noreferrer", children: "Obtenir une clé" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "input",
        {
          value: keyInput,
          onChange: (e) => setKeyInput(e.target.value),
          placeholder: "Clé API Klipy",
          autoFocus: true
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "modal-actions", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: onCancel, children: "Annuler" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "submit", className: "primary", disabled: !keyInput.trim(), children: "Enregistrer" })
      ] })
    ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "input",
        {
          autoFocus: true,
          className: "gif-search-input",
          value: query,
          onChange: (e) => setQuery(e.target.value),
          placeholder: "Rechercher un GIF…"
        }
      ),
      error && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "connection-error", children: error }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "gif-grid", children: [
        results.map((r) => /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            type: "button",
            className: "gif-item",
            onClick: () => pick(r),
            title: r.title,
            disabled: loading,
            children: /* @__PURE__ */ jsxRuntimeExports.jsx("img", { src: r.file?.sm?.gif?.url, alt: "", loading: "lazy" })
          },
          r.id
        )),
        !loading && results.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "hint", children: "Aucun résultat." })
      ] }),
      loading && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "hint", children: "Chargement…" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "modal-actions", children: /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: onCancel, children: "Fermer" }) })
    ] })
  ] }) });
}
const CLIP_SECONDS = 17;
function YouTubeClipPicker({ onInsert, onCancel }) {
  const [urlInput, setUrlInput] = reactExports.useState("");
  const [parsed, setParsed] = reactExports.useState(null);
  const [start, setStart] = reactExports.useState(0);
  const [error, setError] = reactExports.useState(null);
  const [previewKey, setPreviewKey] = reactExports.useState(0);
  const [showPreview, setShowPreview] = reactExports.useState(false);
  function handleUrlChange(value) {
    setUrlInput(value);
    setShowPreview(false);
    const result = parseYoutubeUrl(value);
    if (!result) {
      setParsed(null);
      setError(value.trim() ? "Lien YouTube non reconnu." : null);
      return;
    }
    setError(null);
    setParsed(result);
    if (result.startFromUrl != null) setStart(result.startFromUrl);
  }
  const startSec = Math.max(0, Math.floor(start) || 0);
  const endSec = startSec + CLIP_SECONDS;
  function preview() {
    if (!parsed) return;
    setShowPreview(true);
    setPreviewKey((k) => k + 1);
  }
  function insert() {
    if (!parsed) return;
    onInsert({
      videoId: parsed.videoId,
      start: startSec,
      end: endSec,
      aspectRatio: parsed.isShort ? 9 / 16 : 16 / 9
    });
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "modal-backdrop", onClick: onCancel, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "modal youtube-modal", onClick: (e) => e.stopPropagation(), children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { children: "Ajouter un extrait YouTube" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      "input",
      {
        autoFocus: true,
        value: urlInput,
        onChange: (e) => handleUrlChange(e.target.value),
        placeholder: "Lien d'une vidéo ou d'un short YouTube"
      }
    ),
    error && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "connection-error", children: error }),
    parsed && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "youtube-start-label", children: [
        "Timestamp de début (secondes)",
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "number", min: 0, value: start, onChange: (e) => setStart(Number(e.target.value)) })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "hint", children: [
        "Extrait joué de ",
        formatTime(startSec),
        " à ",
        formatTime(endSec),
        " (",
        CLIP_SECONDS,
        "s max — coupé plus tôt si la vidéo se termine avant)."
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: preview, children: "Prévisualiser" }),
      showPreview && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: `youtube-preview ${parsed.isShort ? "portrait" : "landscape"}`, children: /* @__PURE__ */ jsxRuntimeExports.jsx(
        "iframe",
        {
          src: `https://www.youtube.com/embed/${parsed.videoId}?start=${startSec}&end=${endSec}&autoplay=1&playsinline=1&modestbranding=1&rel=0`,
          title: "Aperçu YouTube",
          allow: "autoplay; encrypted-media",
          frameBorder: "0"
        },
        previewKey
      ) })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "modal-actions", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: onCancel, children: "Annuler" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", className: "primary", disabled: !parsed, onClick: insert, children: "Insérer" })
    ] })
  ] }) });
}
function parseYoutubeUrl(input) {
  const trimmed = input.trim();
  if (!trimmed) return null;
  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\.|^m\./, "");
  let videoId = null;
  let isShort = false;
  if (host === "youtu.be") {
    videoId = url.pathname.split("/").filter(Boolean)[0] || null;
  } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments[0] === "shorts" && segments[1]) {
      videoId = segments[1];
      isShort = true;
    } else if (segments[0] === "embed" && segments[1]) {
      videoId = segments[1];
    } else {
      videoId = url.searchParams.get("v");
    }
  } else {
    return null;
  }
  if (!videoId) return null;
  const tParam = url.searchParams.get("t") || url.searchParams.get("start");
  const startFromUrl = tParam ? parseTimeParam(tParam) : null;
  return { videoId, isShort, startFromUrl };
}
function parseTimeParam(raw) {
  if (/^\d+$/.test(raw)) return Number(raw);
  const match = raw.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!match) return null;
  const [, h, m, s] = match;
  const total = (Number(h) || 0) * 3600 + (Number(m) || 0) * 60 + (Number(s) || 0);
  return total || null;
}
function formatTime(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds) || 0);
  const m = Math.floor(s / 60);
  const sec = String(s % 60).padStart(2, "0");
  return `${m}:${sec}`;
}
function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}
function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
async function resizeImageDataUrl(dataUrl, maxWidth = 1200, quality = 0.82) {
  const img = await loadImage(dataUrl);
  const scale = Math.min(1, maxWidth / img.naturalWidth);
  const width = Math.round(img.naturalWidth * scale);
  const height = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}
const logo = "" + new URL("logo-6FluvbRS.png", import.meta.url).href;
let nextId = 1;
const GIF_URL_RE = /https?:\/\/[^\s"'<>]+\.gif(\?[^\s"'<>]*)?/i;
function App() {
  const [state, setState] = reactExports.useState({ connected: false, sessionCodes: [], serverUrl: "" });
  const [media, setMedia] = reactExports.useState(null);
  const [texts, setTexts] = reactExports.useState([]);
  const [selectedId, setSelectedId] = reactExports.useState(null);
  const [sendDialogOpen, setSendDialogOpen] = reactExports.useState(false);
  const [gifPickerOpen, setGifPickerOpen] = reactExports.useState(false);
  const [youtubePickerOpen, setYoutubePickerOpen] = reactExports.useState(false);
  const [klipyApiKey, setKlipyApiKey] = reactExports.useState("");
  const [klipyCustomerId, setKlipyCustomerId] = reactExports.useState("");
  const [status, setStatus] = reactExports.useState(null);
  const fileInputRef = reactExports.useRef(null);
  reactExports.useEffect(() => {
    window.chekssa.getState().then(setState);
    const off = window.chekssa.onStateChanged(setState);
    return off;
  }, []);
  reactExports.useEffect(() => {
    window.chekssa.getSettings().then((s) => {
      setKlipyApiKey(s.klipyApiKey || "");
      setKlipyCustomerId(s.klipyCustomerId || "");
    });
  }, []);
  reactExports.useEffect(() => {
    if (!status) return;
    const timer = setTimeout(() => setStatus(null), 4e3);
    return () => clearTimeout(timer);
  }, [status]);
  reactExports.useEffect(() => {
    function handlePaste(event) {
      const dt = event.clipboardData;
      if (!dt) return;
      const fileItem = [...dt.items].find((item) => item.kind === "file" && item.type.startsWith("image/"));
      const html = dt.getData("text/html");
      const plain = dt.getData("text/plain");
      const gifUrl = html && html.match(GIF_URL_RE)?.[0] || plain && plain.trim().match(GIF_URL_RE)?.[0];
      if (!fileItem && !gifUrl) return;
      event.preventDefault();
      importPastedImage({ fileItem, gifUrl });
    }
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);
  async function importPastedImage({ fileItem, gifUrl }) {
    if (gifUrl) {
      try {
        const res = await fetch(gifUrl);
        if (res.ok) {
          const blob = await res.blob();
          await setImageFromBlob(blob, true);
          return;
        }
      } catch {
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
    const dataUrl = await readFileAsDataUrl(blob);
    const img = await loadImage(dataUrl);
    setMedia({ kind: "image", dataUrl, aspectRatio: img.naturalWidth / img.naturalHeight, isAnimated });
  }
  async function handlePickImage(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    await setImageFromBlob(file, file.type === "image/gif");
  }
  async function handleGifPicked(blob, aspectRatio) {
    const dataUrl = await readFileAsDataUrl(blob);
    setMedia({ kind: "image", dataUrl, aspectRatio, isAnimated: true });
    setGifPickerOpen(false);
  }
  function handleYoutubeInserted({ videoId, start, end, aspectRatio }) {
    setMedia({ kind: "youtube", videoId, start, end, aspectRatio });
    setYoutubePickerOpen(false);
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
      align: "center"
    };
    setTexts((prev) => [...prev, text]);
    setSelectedId(text.id);
  }
  function updateText(id, patch) {
    setTexts((prev) => prev.map((t) => t.id === id ? { ...t, ...patch } : t));
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
    if (media.kind === "youtube") {
      mediaPayload = media;
    } else {
      const dataUrl = media.isAnimated ? media.dataUrl : await resizeImageDataUrl(media.dataUrl);
      mediaPayload = { kind: "image", dataUrl, aspectRatio: media.aspectRatio, isAnimated: media.isAnimated };
    }
    const payload = { codes, media: mediaPayload, texts };
    const res = await window.chekssa.sendBroadcast(payload);
    setStatus(res.ok ? `Envoyé à : ${codes.join(", ")}` : "Échec de l'envoi.");
  }
  const selectedText = texts.find((t) => t.id === selectedId) || null;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "app", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("aside", { className: "sidebar", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "app-brand", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("img", { src: logo, alt: "", className: "app-logo" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { children: "Chekssa" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        SessionPanel,
        {
          connected: state.connected,
          serverUrl: state.serverUrl,
          lastError: state.lastError,
          sessionCodes: state.sessionCodes,
          onJoin: handleJoin,
          onLeave: handleLeave
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "toolbox", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { children: "Composer" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: () => fileInputRef.current?.click(), children: "Ajouter une image" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "input",
          {
            ref: fileInputRef,
            type: "file",
            accept: "image/*",
            onChange: handlePickImage,
            style: { display: "none" }
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: () => setGifPickerOpen(true), children: "Chercher un GIF" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: () => setYoutubePickerOpen(true), children: "Ajouter une vidéo YouTube" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: addText, disabled: !media, children: "Ajouter un texte" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "hint", children: "Astuce : Ctrl+V colle directement une image ou un GIF copié." })
      ] }),
      selectedText && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "text-editor", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { children: "Texte sélectionné" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "textarea",
          {
            value: selectedText.content,
            onChange: (e) => updateText(selectedText.id, { content: e.target.value }),
            rows: 2
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { children: [
          "Taille",
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "input",
            {
              type: "range",
              min: 2,
              max: 14,
              step: 0.5,
              value: selectedText.fontPct,
              onChange: (e) => updateText(selectedText.id, { fontPct: Number(e.target.value) })
            }
          )
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { children: [
          "Couleur",
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "input",
            {
              type: "color",
              value: selectedText.color,
              onChange: (e) => updateText(selectedText.id, { color: e.target.value })
            }
          )
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "checkbox-label", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "input",
            {
              type: "checkbox",
              checked: selectedText.bold,
              onChange: (e) => updateText(selectedText.id, { bold: e.target.checked })
            }
          ),
          "Gras"
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "align-group", children: [
          ["left", "Gauche"],
          ["center", "Centre"],
          ["right", "Droite"]
        ].map(([value, label]) => /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            type: "button",
            className: selectedText.align === value ? "primary" : "",
            onClick: () => updateText(selectedText.id, { align: value }),
            children: label
          },
          value
        )) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "hint", children: "Glissez le texte pour le déplacer, ou ses bords gauche/droit pour changer sa largeur." }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", className: "danger", onClick: () => deleteText(selectedText.id), children: "Supprimer ce texte" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", className: "send-button primary", onClick: handleSendClick, children: "Envoyer" }),
      status && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "status", children: status })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("main", { className: "canvas-area", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
      ImageCanvas,
      {
        media,
        texts,
        selectedId,
        onSelect: setSelectedId,
        onMove: updateText,
        onDeselect: () => setSelectedId(null)
      }
    ) }),
    sendDialogOpen && /* @__PURE__ */ jsxRuntimeExports.jsx(SendDialog, { sessionCodes: state.sessionCodes, onCancel: () => setSendDialogOpen(false), onConfirm: doSend }),
    gifPickerOpen && /* @__PURE__ */ jsxRuntimeExports.jsx(
      GifPicker,
      {
        apiKey: klipyApiKey,
        customerId: klipyCustomerId,
        onSaveApiKey: handleSaveKlipyKey,
        onSelect: handleGifPicked,
        onCancel: () => setGifPickerOpen(false)
      }
    ),
    youtubePickerOpen && /* @__PURE__ */ jsxRuntimeExports.jsx(YouTubeClipPicker, { onInsert: handleYoutubeInserted, onCancel: () => setYoutubePickerOpen(false) })
  ] });
}
ReactDOM.createRoot(document.getElementById("root")).render(
  /* @__PURE__ */ jsxRuntimeExports.jsx(React.StrictMode, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(App, {}) })
);
