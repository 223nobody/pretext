import { useEffect, useRef, type CSSProperties, type RefObject } from "react";

import { useReaderStore } from "../../store/readerStore";

interface BackgroundLayerProps {
  enabled: boolean;
  /**
   * The shared <video> element (created by useBackgroundVideo and hoisted to
   * PageCanvas). In CSS mode this component re-parents it into its own node so
   * the video is visible; the same element is what the Canvas renderer draws
   * from, keeping the auto-mask in sync (see NEXT_DEVELOPMENT_PLAN §3.3.3).
   */
  videoRef: RefObject<HTMLVideoElement | null>;
}

export function BackgroundLayer({ enabled, videoRef }: BackgroundLayerProps) {
  const backgroundVideo = useReaderStore((state) => state.backgroundVideo);
  const mountRef = useRef<HTMLDivElement | null>(null);
  const hasActiveVideo = enabled && Boolean(backgroundVideo.url);

  // Re-parent the shared video element into this layer while a video is set.
  useEffect(() => {
    const mount = mountRef.current;
    const video = videoRef.current;
    if (!mount || !video) return;

    if (hasActiveVideo) {
      if (video.parentElement !== mount) {
        mount.appendChild(video);
      }
    } else if (video.parentElement === mount) {
      mount.removeChild(video);
    }

    return () => {
      // On unmount (e.g. switching to Canvas mode) detach so the element can be
      // re-hosted elsewhere without being destroyed.
      if (video.parentElement === mount) {
        mount.removeChild(video);
      }
    };
  }, [hasActiveVideo, videoRef]);

  // Keep the inverted class in sync with the store.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.classList.toggle("is-inverted", backgroundVideo.inverted);
  }, [backgroundVideo.inverted, videoRef]);

  return (
    <div
      className={`background-layer ${hasActiveVideo ? "has-video" : ""}`}
      style={
        {
          "--video-sensitivity": `${backgroundVideo.sensitivity}%`,
          "--video-edge": `${backgroundVideo.edgePrecision}px`,
          "--video-outline": `${backgroundVideo.outlineWidth}px`,
        } as CSSProperties
      }
      aria-hidden="true"
    >
      <div ref={mountRef} className="background-video-mount" />
      {hasActiveVideo ? <div className="video-outline" /> : null}
    </div>
  );
}
