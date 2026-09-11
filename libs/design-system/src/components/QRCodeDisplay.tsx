"use client";

import { useEffect, useState } from "react";

export type QRTrustStatus = "valid" | "checked-in" | "neutral";

export interface QRCodeDisplayProps {
  /**
   * A raw value to encode client-side (any string — a ticket's qrToken,
   * a URL, etc). Ignored if `dataUrl` is also given.
   */
  value?: string;
  /**
   * A pre-rendered QR image (e.g. checkin-service already returns one
   * per ticket) — skips client-side encoding entirely and just displays
   * it, so the same component gives a consistent frame/loading/error
   * treatment either way.
   */
  dataUrl?: string;
  size?: number;
  /**
   * Trust-signal treatment: "valid" wraps the code in the emerald
   * border/glow + a "STATUS: VALID" shield badge (an untouched, live
   * ticket); "checked-in" shows the same frame in a neutral tone with
   * "ALREADY USED" instead, so a redeemed ticket never looks like a
   * fresh, sharable one. Omit for a bare QR code with no status chrome.
   */
  status?: QRTrustStatus;
  className?: string;
}

const STATUS_COPY: Record<Exclude<QRTrustStatus, "neutral">, string> = {
  valid: "STATUS: VALID",
  "checked-in": "ALREADY USED",
};

export function QRCodeDisplay({
  value,
  dataUrl,
  size = 192,
  status = "neutral",
  className = "",
}: QRCodeDisplayProps) {
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (dataUrl || !value) return;
    let cancelled = false;
    setGeneratedUrl(null);
    setError(false);
    import("qrcode")
      .then((QRCode) => QRCode.toDataURL(value, { width: size, margin: 1 }))
      .then((url) => {
        if (!cancelled) setGeneratedUrl(url);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [value, dataUrl, size]);

  const resolvedUrl = dataUrl ?? generatedUrl;

  const frameClasses =
    status === "valid"
      ? "border-trust-500 shadow-glow-trust"
      : status === "checked-in"
        ? "border-zinc-700"
        : "border-zinc-800";

  let inner: React.ReactNode;
  if (error) {
    inner = (
      <div
        style={{ width: size, height: size }}
        className="flex items-center justify-center bg-zinc-900 p-2 text-center text-xs text-zinc-400"
      >
        Couldn&apos;t render QR code
      </div>
    );
  } else if (!resolvedUrl) {
    inner = (
      <div
        style={{ width: size, height: size }}
        className="animate-pulse bg-zinc-800"
      />
    );
  } else {
    inner = (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={resolvedUrl} alt="QR code" width={size} height={size} />
    );
  }

  return (
    <div className={`inline-flex flex-col items-center gap-2 ${className}`}>
      <div className={`rounded-none border-2 bg-white p-2 ${frameClasses}`}>
        {inner}
      </div>
      {status !== "neutral" && (
        <p
          className={`flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-widest ${
            status === "valid" ? "text-trust-500" : "text-zinc-500"
          }`}
        >
          <ShieldIcon />
          {STATUS_COPY[status]}
        </p>
      )}
    </div>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-3.5 w-3.5">
      <path
        d="M12 2 4 5v6c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V5l-8-3Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="m8.5 12 2.5 2.5L16 9"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
