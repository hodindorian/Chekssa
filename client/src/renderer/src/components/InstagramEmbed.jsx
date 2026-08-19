import { useEffect, useRef } from "react";
import { loadInstagramEmbeds } from "../embedWidgets.js";

export default function InstagramEmbed({ postUrl, className }) {
  const blockquoteRef = useRef(null);

  useEffect(() => {
    if (!postUrl) return;
    loadInstagramEmbeds()
      .then((instgrm) => instgrm.Embeds.process())
      .catch(() => {});
  }, [postUrl]);

  return (
    <div className={`widget-embed-wrap ${className || ""}`}>
      <a
        className="widget-embed-fallback"
        href={postUrl}
        target="_blank"
        rel="noreferrer"
      >
        Voir sur Instagram
      </a>
      <blockquote
        ref={blockquoteRef}
        className="instagram-media"
        data-instgrm-permalink={postUrl}
        data-instgrm-version="14"
        style={{ margin: 0, width: "100%" }}
      />
    </div>
  );
}
