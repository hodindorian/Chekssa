// Twitter/X and Instagram don't offer a plain <iframe src="..."> embed like
// YouTube or TikTok do (Instagram's own /embed/ page even sends
// X-Frame-Options: DENY). The only supported route is their official widget
// script, which scans the DOM for a placeholder blockquote and replaces it
// with its own iframe.

let twitterScriptPromise = null;

export function loadTwitterWidgets() {
  if (window.twttr?.widgets) return Promise.resolve(window.twttr);
  if (twitterScriptPromise) return twitterScriptPromise;
  twitterScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://platform.twitter.com/widgets.js";
    script.async = true;
    script.onload = () => resolve(window.twttr);
    script.onerror = () => {
      twitterScriptPromise = null;
      reject(new Error("Impossible de charger le lecteur X/Twitter."));
    };
    document.body.appendChild(script);
  });
  return twitterScriptPromise;
}

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
