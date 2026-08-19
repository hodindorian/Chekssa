// Instagram's own /embed/ page sends X-Frame-Options: DENY, so a plain
// <iframe src="..."> isn't an option there like it is for YouTube/TikTok.
// The only supported route is their official widget script, which scans the
// DOM for a placeholder blockquote and replaces it with its own iframe.
// (X/Twitter used to go through the same kind of widget here too, but that
// always shows the full tweet card with click-to-play; see twitterVideo.js
// for the direct-video-URL approach used instead.)

let instagramScriptPromise = null;

export function loadInstagramEmbeds() {
  if (window.instgrm?.Embeds) return Promise.resolve(window.instgrm);
  if (instagramScriptPromise) return instagramScriptPromise;
  instagramScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://www.instagram.com/embed.js";
    script.async = true;
    script.onload = () => resolve(window.instgrm);
    script.onerror = () => {
      instagramScriptPromise = null;
      reject(new Error("Impossible de charger le lecteur Instagram."));
    };
    document.body.appendChild(script);
  });
  return instagramScriptPromise;
}
