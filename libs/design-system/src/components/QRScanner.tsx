"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

const RESCAN_DEBOUNCE_MS = 2000;

export interface QRScannerProps {
  /** Called once per distinct decoded value (debounced — a code sitting
   * in frame for several seconds only fires once every RESCAN_DEBOUNCE_MS). */
  onScan: (value: string) => void;
  /** Set false to pause the camera without unmounting (e.g. while the
   * host is showing a lookup result). Defaults to true. */
  active?: boolean;
  className?: string;
}

export function QRScanner({ onScan, active = true, className = "" }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastValueRef = useRef<string | null>(null);
  const lastScanAtRef = useRef(0);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    function tick() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx && canvas.width > 0 && canvas.height > 0) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(frame.data, frame.width, frame.height);
          if (code?.data) {
            const now = Date.now();
            const isNewValue = code.data !== lastValueRef.current;
            const debounceElapsed =
              now - lastScanAtRef.current > RESCAN_DEBOUNCE_MS;
            if (isNewValue || debounceElapsed) {
              lastValueRef.current = code.data;
              lastScanAtRef.current = now;
              onScanRef.current(code.data);
            }
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        rafRef.current = requestAnimationFrame(tick);
      } catch {
        if (!cancelled) {
          setError("Camera access denied or unavailable — use manual entry instead.");
        }
      }
    }

    start();

    return () => {
      cancelled = true;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [active]);

  if (error) {
    return (
      <p className={`font-medium text-brand-400 ${className}`}>{error}</p>
    );
  }

  return (
    <div className={`relative aspect-square overflow-hidden rounded-none bg-black ${className}`}>
      <video
        ref={videoRef}
        muted
        playsInline
        className="h-full w-full object-cover"
      />
      <canvas ref={canvasRef} hidden />
      <div className="pointer-events-none absolute inset-8 rounded-none border-2 border-brand-500" />
    </div>
  );
}
