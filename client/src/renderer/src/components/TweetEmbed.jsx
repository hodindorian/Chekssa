import { useEffect, useRef, useState } from "react";
import { loadTwitterWidgets } from "../embedWidgets.js";

export default function TweetEmbed({ tweetId, className }) {
  const containerRef = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    const container = containerRef.current;
    if (!container || !tweetId) return undefined;
    container.innerHTML = "";

    loadTwitterWidgets()
      .then((twttr) =>
        twttr.widgets.createTweet(tweetId, container, { theme: "dark", dnt: true, align: "center" })
      )
      .then((el) => {
        if (!cancelled && !el) setFailed(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [tweetId]);

  return (
    <div className={`widget-embed-wrap ${className || ""}`}>
      <div ref={containerRef} className="widget-embed-target" />
      {failed && (
        <a
          className="widget-embed-fallback"
          href={`https://twitter.com/i/status/${tweetId}`}
          target="_blank"
          rel="noreferrer"
        >
          Voir le tweet sur X
        </a>
      )}
    </div>
  );
}
