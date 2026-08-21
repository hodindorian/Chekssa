import { session } from "electron";

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
