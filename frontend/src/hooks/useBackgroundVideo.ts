import { useEffect, useRef, type RefObject } from "react";

import {
  analyzeVideoFrameSample,
  createBackgroundModel,
  frameHasAlpha,
  sampleVideoFrame,
  type SampledVideoFrame,
  type VideoBackgroundModel,
} from "../lib/videoMaskAnalysis";
import { useReaderStore } from "../store/readerStore";

/**
 * Owns a single background <video> element shared by both render modes.
 *
 * The Textdance-like behavior has two parts:
 * 1. The video is kept attached/playing so Canvas can draw live frames.
 * 2. Auto-mask sampling feeds per-row contour spans into Pretext layout, so
 *    text wraps the moving video foreground instead of a static rectangle.
 */
export function useBackgroundVideo(enabled: boolean): RefObject<HTMLVideoElement | null> {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const backgroundModelRef = useRef<VideoBackgroundModel | null>(null);
  const alphaModeRef = useRef(false);
  const backgroundSamplesRef = useRef<SampledVideoFrame[]>([]);
  const firstResampleRef = useRef(true);

  const backgroundVideo = useReaderStore((state) => state.backgroundVideo);
  const setBackgroundMask = useReaderStore((state) => state.setBackgroundMask);
  const resampleToken = useReaderStore((state) => state.resampleToken);

  const { url, autoMask, sensitivity, inverted, edgePrecision } = backgroundVideo;

  // Create the element once.
  if (!videoRef.current && typeof document !== "undefined") {
    const video = document.createElement("video");
    video.autoplay = true;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = "auto";
    video.setAttribute("playsinline", "");
    video.style.position = "absolute";
    video.style.inset = "0";
    video.style.width = "100%";
    video.style.height = "100%";
    video.style.objectFit = "contain";
    video.style.objectPosition = "center";
    videoRef.current = video;
  }

  // Reset analysis state when the media source changes, or when the reader has
  // no content. Empty reader pages should not load or keep a video mask.
  useEffect(() => {
    backgroundModelRef.current = null;
    alphaModeRef.current = false;
    backgroundSamplesRef.current = [];
    setBackgroundMask({ contour: null });
  }, [url, enabled, setBackgroundMask]);

  // Attach / detach the media source and control playback.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!enabled || !url) {
      video.pause();
      video.removeAttribute("src");
      video.load();
      return;
    }

    const ensurePlaying = () => {
      void video.play().catch(() => {
        // Muted autoplay should usually work; if it is delayed, later user
        // interaction or loadeddata/canplay events will retry.
      });
    };

    if (video.src !== url) {
      video.src = url;
      video.load();
    }

    video.addEventListener("loadeddata", ensurePlaying);
    video.addEventListener("canplay", ensurePlaying);
    ensurePlaying();

    return () => {
      video.removeEventListener("loadeddata", ensurePlaying);
      video.removeEventListener("canplay", ensurePlaying);
    };
  }, [url, enabled]);

  // Auto-mask analysis loop. Transparent videos use alpha directly. Ordinary
  // RGB videos collect a background model first, matching Textdance's approach.
  useEffect(() => {
    if (!enabled || !url || !autoMask) {
      return;
    }

    let frameId = 0;
    let lastSample = 0;
    const SAMPLE_INTERVAL_MS = 100;
    const BACKGROUND_SAMPLE_COUNT = 14;

    const sample = (timestamp: number) => {
      frameId = requestAnimationFrame(sample);
      if (timestamp - lastSample < SAMPLE_INTERVAL_MS) {
        return;
      }

      const video = videoRef.current;
      if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        return;
      }

      const frame = sampleVideoFrame(video);
      if (!frame) return;
      lastSample = timestamp;

      if (!alphaModeRef.current && !backgroundModelRef.current && backgroundSamplesRef.current.length === 0) {
        alphaModeRef.current = frameHasAlpha(frame);
      }

      if (!alphaModeRef.current && !backgroundModelRef.current) {
        backgroundSamplesRef.current.push(frame);
        if (backgroundSamplesRef.current.length < BACKGROUND_SAMPLE_COUNT) {
          return;
        }
        backgroundModelRef.current = createBackgroundModel(backgroundSamplesRef.current);
        backgroundSamplesRef.current = [];
      }

      const result = analyzeVideoFrameSample(frame, {
        sensitivity,
        inverted,
        edgePrecision,
      }, backgroundModelRef.current);

      if (result) {
        setBackgroundMask(result);
      }
    };

    frameId = requestAnimationFrame(sample);
    return () => cancelAnimationFrame(frameId);
  }, [url, enabled, autoMask, sensitivity, inverted, edgePrecision, setBackgroundMask]);

  // Manual re-sample/rebuild. For RGB videos this intentionally drops the old
  // background model so the next auto-mask loop recollects it.
  useEffect(() => {
    if (firstResampleRef.current) {
      firstResampleRef.current = false;
      return;
    }

    backgroundModelRef.current = null;
    alphaModeRef.current = false;
    backgroundSamplesRef.current = [];
    setBackgroundMask({ contour: null });

    const video = videoRef.current;
    if (!enabled || !url || !video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return;
    }

    const frame = sampleVideoFrame(video);
    if (!frame) return;

    const result = analyzeVideoFrameSample(frame, { sensitivity, inverted, edgePrecision });
    if (result) {
      alphaModeRef.current = frameHasAlpha(frame);
      setBackgroundMask(result);
    }
    // The token is the trigger; the current settings are read at trigger time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resampleToken, enabled]);

  return videoRef;
}
