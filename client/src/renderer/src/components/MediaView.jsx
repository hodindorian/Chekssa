import { useEffect, useRef, useState } from "react";

// Renders whatever is currently composed/received: a static image/GIF, or one
// of the supported video kinds. `autoplay` distinguishes the overlay (plays
// immediately, no user gesture) from the composer canvas (stays paused/
// controllable so editing isn't interrupted by playback).
export default function MediaView({ media, autoplay = false, className = "", onEnded }) {
  if (!media) return null;

  if (media.kind === "youtube") {
    const playback = autoplay ? "autoplay=1&mute=0&controls=0&iv_load_policy=3" : "controls=1";
    return (
      <iframe
        className={className}
        src={`https://www.youtube.com/embed/${media.videoId}?start=${media.start}&end=${media.end}&${playback}&modestbranding=1&rel=0&playsinline=1`}
        title="Extrait YouTube"
        allow="autoplay; encrypted-media"
        frameBorder="0"
      />
    );
  }

  if (media.kind === "tiktok") {
    return <TikTokPlayer className={className} videoId={media.videoId} autoplay={autoplay} onEnded={onEnded} />;
  }

  if (media.kind === "twitter") {
    // Resolved to a direct CDN video URL at insert time (see
    // videoResolvers.js, main process) - a plain autoplaying <video>, not
    // the official widget's full post card.
    return <VideoElement className={className} src={media.videoUrl} autoplay={autoplay} />;
  }

  if (media.kind === "local-video") {
    return (
      <VideoElement
        className={className}
        src={media.dataUrl}
        start={media.start}
        end={media.end}
        autoplay={autoplay}
      />
    );
  }

  return <img className={className} src={media.dataUrl} alt="" draggable={false} />;
}

function VideoElement({ src, start = 0, end, autoplay, className }) {
  const videoRef = useRef(null);
  const [failed, setFailed] = useState(false);

  function tryPlay() {
    const v = videoRef.current;
    if (!v || !autoplay) return;
    v.play().catch((err) => {
      // Some CDNs serve the first response as a short segment/preview
      // rather than a fully seekable file, so the browser can refuse the
      // initial autoplay attempt even though the element clearly has
      // playable data - this fires again on "canplaythrough" once more has
      // buffered.
      // eslint-disable-next-line no-console
      console.error("Autoplay rejected:", src, err);
    });
  }

  function handleLoadedMetadata() {
    const v = videoRef.current;
    if (!v) return;
    if (start) v.currentTime = start;
    tryPlay();
  }

  function handleTimeUpdate() {
    const v = videoRef.current;
    if (!v || !end) return;
    if (v.currentTime >= end) v.pause();
  }

  function handleError() {
    // A black rectangle with no visible message is the worst failure mode -
    // this is a video/network issue (dead link, blocked host...), not
    // something retrying would fix, so surface it instead of hiding it.
    // eslint-disable-next-line no-console
    console.error("Video failed to load:", src, videoRef.current?.error);
    setFailed(true);
  }

  if (failed) {
    return (
      <div className={`video-failed ${className}`}>
        <p>Vidéo indisponible.</p>
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      className={className}
      src={src}
      controls={!autoplay}
      autoPlay={autoplay}
      playsInline
      onLoadedMetadata={handleLoadedMetadata}
      onCanPlay={tryPlay}
      onTimeUpdate={handleTimeUpdate}
      onError={handleError}
    />
  );
}

// TikTok's `muted=0` param only unlocks the volume slider - autoplay still
// starts muted regardless, so unmuting needs its documented postMessage API
// (https://developers.tiktok.com/doc/embed-player). Retried a few times
// since we can't know exactly when the player's own listener attaches.
function TikTokPlayer({ videoId, autoplay, className, onEnded }) {
  const iframeRef = useRef(null);

  function sendCommand(type, value) {
    iframeRef.current?.contentWindow?.postMessage({ "x-tiktok-player": true, type, value }, "*");
  }

  function handleLoad() {
    if (!autoplay) return;
    for (const delay of [0, 300, 800, 1500]) {
      setTimeout(() => {
        sendCommand("unMute");
        sendCommand("play");
      }, delay);
    }
  }

  // The overlay otherwise only knows to close itself after a flat 60s
  // fallback (no way to know a TikTok clip's real length up front) - most
  // clips are much shorter than that and just sit there finished, so close
  // as soon as the player itself reports playback has ended instead of
  // waiting out the fallback.
  useEffect(() => {
    if (!onEnded) return undefined;
    function handleMessage(event) {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (!event.data?.["x-tiktok-player"]) return;
      if (event.data.type === "onStateChange" && event.data.value === 0) onEnded();
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onEnded]);

  return (
    <iframe
      ref={iframeRef}
      className={className}
      src={`https://www.tiktok.com/player/v1/${videoId}?autoplay=${autoplay ? 1 : 0}&muted=0&controls=${
        autoplay ? 0 : 1
      }&loop=0&music_info=0&description=0`}
      title="Vidéo TikTok"
      allow="autoplay; encrypted-media; fullscreen"
      frameBorder="0"
      onLoad={handleLoad}
    />
  );
}
