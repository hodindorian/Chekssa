import { useEffect, useRef, useState } from "react";

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
