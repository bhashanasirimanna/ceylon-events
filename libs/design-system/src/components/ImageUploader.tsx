"use client";

import { useRef, useState } from "react";

export type MediaCategory =
  | "menu-photo"
  | "event-banner"
  | "payment-proof"
  | "restaurant-cover";

interface PresignResponse {
  uploadUrl: string;
  publicUrl: string;
  objectKey: string;
}

const ACCEPTED_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"];

export interface ImageUploaderProps {
  /** Which media-service bucket prefix this upload belongs to. */
  category: MediaCategory;
  /** Public URLs already attached (in display order). */
  urls: string[];
  onChange: (urls: string[]) => void;
  /**
   * Each host app has its own apiFetch (different token storage/base URL),
   * so it's injected here rather than this component owning any auth of
   * its own — it only ever needs to reach the media-service's presign/
   * confirm endpoints.
   */
  apiFetch: <T>(path: string, options?: RequestInit) => Promise<T>;
  maxImages?: number;
  className?: string;
}

export function ImageUploader({
  category,
  urls,
  onChange,
  apiFetch,
  maxImages = 6,
  className = "",
}: ImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setError(null);

    const files = Array.from(fileList).slice(
      0,
      Math.max(0, maxImages - urls.length),
    );
    if (files.length === 0) {
      setError(`You can attach up to ${maxImages} images.`);
      return;
    }

    setIsUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of files) {
        const contentType = ACCEPTED_CONTENT_TYPES.includes(file.type)
          ? file.type
          : "application/octet-stream";
        if (!ACCEPTED_CONTENT_TYPES.includes(file.type)) {
          throw new Error(`"${file.name}" isn't a JPEG, PNG, or WebP image`);
        }

        const presign = await apiFetch<PresignResponse>(
          "/media/presign-upload",
          {
            method: "POST",
            body: JSON.stringify({
              fileName: file.name,
              contentType,
              category,
            }),
          },
        );

        const putRes = await fetch(presign.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": contentType },
          body: file,
        });
        if (!putRes.ok) {
          throw new Error(`Failed to upload "${file.name}" — please try again`);
        }

        await apiFetch("/media/confirm", {
          method: "POST",
          body: JSON.stringify({ objectKey: presign.objectKey }),
        });

        uploaded.push(presign.publicUrl);
      }
      onChange([...urls, ...uploaded]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function remove(index: number) {
    onChange(urls.filter((_, i) => i !== index));
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= urls.length) return;
    const next = [...urls];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-3">
        {urls.map((url, index) => (
          <div
            key={url}
            className="group relative h-24 w-24 overflow-hidden rounded-none border border-zinc-800"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={`Photo ${index + 1}`}
              loading="lazy"
              width={96}
              height={96}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 flex flex-col items-center justify-between bg-black/0 p-1 opacity-0 transition-opacity group-hover:bg-black/40 group-hover:opacity-100">
              <div className="flex w-full justify-end">
                <button
                  type="button"
                  onClick={() => remove(index)}
                  aria-label="Remove photo"
                  className="rounded-full bg-white/90 px-1.5 text-xs font-bold text-red-600"
                >
                  ×
                </button>
              </div>
              <div className="flex w-full justify-center gap-1">
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label="Move earlier"
                  className="rounded-full bg-white/90 px-1.5 text-xs disabled:opacity-40"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === urls.length - 1}
                  aria-label="Move later"
                  className="rounded-full bg-white/90 px-1.5 text-xs disabled:opacity-40"
                >
                  →
                </button>
              </div>
            </div>
            {index === 0 && (
              <span className="absolute left-1 top-1 rounded-none bg-brand-600/90 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-white">
                Cover
              </span>
            )}
          </div>
        ))}

        {urls.length < maxImages && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
            className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-none border-2 border-dashed border-zinc-700 text-zinc-500 transition-colors hover:border-brand-500 hover:text-brand-500 disabled:opacity-50"
          >
            <span className="text-2xl leading-none">+</span>
            <span className="text-[10px]">
              {isUploading ? "Uploading…" : "Add photo"}
            </span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_CONTENT_TYPES.join(",")}
        multiple
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
