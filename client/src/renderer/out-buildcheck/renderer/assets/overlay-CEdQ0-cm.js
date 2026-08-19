import { r as reactExports, j as jsxRuntimeExports, R as ReactDOM } from "./client-DSTAIts0.js";
function Overlay() {
  const [payload, setPayload] = reactExports.useState(null);
  const [expanded, setExpanded] = reactExports.useState(false);
  reactExports.useEffect(() => {
    const off = window.chekssaOverlay.onPayload(setPayload);
    const offExpanded = window.chekssaOverlay.onExpandedChanged(setExpanded);
    return () => {
      off();
      offExpanded();
    };
  }, []);
  if (!payload) return null;
  function toggleExpanded() {
    window.chekssaOverlay.setExpanded(!expanded);
  }
  function handleClose(event) {
    event.stopPropagation();
    window.chekssaOverlay.close();
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: `overlay-card ${expanded ? "expanded" : ""}`, onClick: toggleExpanded, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "overlay-close", onClick: handleClose, title: "Fermer", children: "×" }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "overlay-image-wrap", children: [
      payload.media?.kind === "youtube" ? /* @__PURE__ */ jsxRuntimeExports.jsx(
        "iframe",
        {
          className: "overlay-youtube",
          src: `https://www.youtube.com/embed/${payload.media.videoId}?start=${payload.media.start}&end=${payload.media.end}&autoplay=1&mute=0&playsinline=1&controls=0&modestbranding=1&rel=0&iv_load_policy=3`,
          title: "Extrait YouTube",
          allow: "autoplay; encrypted-media",
          frameBorder: "0"
        }
      ) : /* @__PURE__ */ jsxRuntimeExports.jsx("img", { src: payload.media?.dataUrl, alt: "", draggable: false }),
      payload.texts?.map((t) => /* @__PURE__ */ jsxRuntimeExports.jsx(
        "span",
        {
          className: "overlay-text",
          style: {
            left: `${t.xPct}%`,
            top: `${t.yPct}%`,
            width: `${t.widthPct ?? 30}%`,
            fontSize: `${t.fontPct || 5}cqw`,
            color: t.color || "#ffffff",
            fontWeight: t.bold ? 700 : 400,
            textAlign: t.align || "left"
          },
          children: t.content
        },
        t.id
      ))
    ] })
  ] });
}
ReactDOM.createRoot(document.getElementById("root")).render(/* @__PURE__ */ jsxRuntimeExports.jsx(Overlay, {}));
