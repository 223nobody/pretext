import { useEffect, useRef, type CSSProperties } from "react";

import { useReaderStore } from "../../store/readerStore";

export function BackgroundLayer() {
  const backgroundVideo = useReaderStore((state) => state.backgroundVideo);
  const setBackgroundMask = useReaderStore((state) => state.setBackgroundMask);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!backgroundVideo.url || !backgroundVideo.autoMask) {
      return;
    }

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    let frameId = 0;
    let lastSample = 0;

    const sampleFrame = (timestamp: number) => {
      frameId = requestAnimationFrame(sampleFrame);
      if (!context || timestamp - lastSample < 450) {
        return;
      }

      const video = videoRef.current;
      if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        return;
      }

      lastSample = timestamp;
      const width = 80;
      const height = Math.max(45, Math.round((video.videoHeight / Math.max(video.videoWidth, 1)) * width));
      canvas.width = width;
      canvas.height = height;
      context.drawImage(video, 0, 0, width, height);

      const pixels = context.getImageData(0, 0, width, height).data;
      const threshold = 24 + backgroundVideo.sensitivity * 1.5;
      let count = 0;
      let sumX = 0;
      let sumY = 0;
      let minX = width;
      let maxX = 0;
      let minY = height;
      let maxY = 0;

      for (let y = 0; y < height; y += 2) {
        for (let x = 0; x < width; x += 2) {
          const index = (y * width + x) * 4;
          const r = pixels[index];
          const g = pixels[index + 1];
          const b = pixels[index + 2];
          const brightness = (r + g + b) / 3;
          const contrast = Math.abs(r - brightness) + Math.abs(g - brightness) + Math.abs(b - brightness);
          const active = backgroundVideo.inverted ? brightness < threshold : contrast + brightness > threshold * 2;
          if (active) {
            count++;
            sumX += x;
            sumY += y;
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
          }
        }
      }

      if (count < 12) {
        return;
      }

      const centerX = (sumX / count / width) * 100;
      const centerY = (sumY / count / height) * 100;
      const span = Math.max((maxX - minX) / width, (maxY - minY) / height);
      const size = Math.min(420, Math.max(140, span * 620 + backgroundVideo.edgePrecision * 12));

      setBackgroundMask({
        x: Math.round(centerX),
        y: Math.round(centerY),
        size: Math.round(size),
      });
    };

    frameId = requestAnimationFrame(sampleFrame);
    return () => cancelAnimationFrame(frameId);
  }, [
    backgroundVideo.autoMask,
    backgroundVideo.edgePrecision,
    backgroundVideo.inverted,
    backgroundVideo.sensitivity,
    backgroundVideo.url,
    setBackgroundMask,
  ]);

  return (
    <div
      className={`background-layer ${backgroundVideo.url ? "has-video" : ""}`}
      style={
        {
          "--video-sensitivity": `${backgroundVideo.sensitivity}%`,
          "--video-edge": `${backgroundVideo.edgePrecision}px`,
          "--video-outline": `${backgroundVideo.outlineWidth}px`,
        } as CSSProperties
      }
      aria-hidden="true"
    >
      {backgroundVideo.url ? (
        <>
          <video
            ref={videoRef}
            src={backgroundVideo.url}
            autoPlay
            loop
            muted
            playsInline
            className={backgroundVideo.inverted ? "is-inverted" : ""}
          />
          <div className="video-outline" />
        </>
      ) : null}
    </div>
  );
}
