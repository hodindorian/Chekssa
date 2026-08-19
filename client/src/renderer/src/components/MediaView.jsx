import { useRef } from "react";
import InstagramEmbed from "./InstagramEmbed.jsx";

// Renders whatever is currently composed/received: a static image/GIF, or one
// of the supported video kinds. `autoplay` distinguishes the overlay (plays
// immediately, no user gesture) from the composer canvas (stays paused/
// controllable so editing isn't interrupted by playback).
export default function MediaView({ media, autoplay = false, className = "" }) {
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
    return (
      <iframe
        className={className}
        src={`https://www.tiktok.com/player/v1/${media.videoId}?autoplay=${autoplay ? 1 : 0}&muted=0&controls=${
          autoplay ? 0 : 1
        }&loop=0&music_info=0&description=0`}
        title="Vidéo TikTok"
        allow="autoplay; encrypted-media; fullscreen"
        frameBorder="0"
      />
    );
  }

  if (media.kind === "twitter") {
    // Resolved to a direct CDN video URL at insert time (see
    // twitterVideo.js) - a plain autoplaying <video>, not the official
    // widget's full tweet card.
    return <VideoElement className={className} src={media.videoUrl} autoplay={autoplay} />;
  }

  if (media.kind === "instagram") {
    return <InstagramEmbed postUrl={media.postUrl} className={className} />;
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

  function handleLoadedMetadata() {
    const v = videoRef.current;
    if (!v) return;
    if (start) v.currentTime = start;
    if (autoplay) v.play().catch(() => {});
  }

  function handleTimeUpdate() {
    const v = videoRef.current;
    if (!v || !end) return;
    if (v.currentTime >= end) v.pause();
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
      onTimeUpdate={handleTimeUpdate}
    />
  );
}
