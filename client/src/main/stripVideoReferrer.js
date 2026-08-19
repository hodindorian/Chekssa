import { session } from "electron";

// The `referrerpolicy` HTML attribute isn't defined for <video>/<audio>
// elements (only <a>, <img>, <iframe>, <script>, <link> - see the HTML spec),
// so it can't be used to stop our own page's Referer header from being sent
// on video CDN requests. Twitter's video CDN hotlink-protects by Referer and
// 403s anything that isn't twitter.com/x.com - which silently breaks
// playback (a black box, no visible error). Stripping the header at the
// network layer works regardless of element type.
const REFERER_STRIP_HOSTS = /video\.twimg\.com/i;

export function stripVideoCdnReferrer() {
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    if (!REFERER_STRIP_HOSTS.test(details.url)) {
      callback({});
      return;
    }
    const requestHeaders = { ...details.requestHeaders };
    for (const key of Object.keys(requestHeaders)) {
      if (key.toLowerCase() === "referer") delete requestHeaders[key];
    }
    callback({ requestHeaders });
  });
}
