"use client";

import { useState } from "react";
import { Button } from "@ceylon/design-system";
import { RatingSubjectType } from "@ceylon/shared-types";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { RatingSnapshot } from "@/lib/types";

interface RatingFormProps {
  orderId: string;
  eventId: string;
  subjectType: RatingSubjectType;
  subjectId: string;
  label: string;
  ratedLabel: string;
  compact?: boolean;
}

export function RatingForm({
  orderId,
  eventId,
  subjectType,
  subjectId,
  label,
  ratedLabel,
  compact = false,
}: RatingFormProps) {
  const [stars, setStars] = useState(0);
  const [hoverStars, setHoverStars] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rated, setRated] = useState<RatingSnapshot | null>(null);
  const [status, setStatus] = useState<"idle" | "already-rated" | "not-eligible">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (stars < 1) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await apiFetch<RatingSnapshot>("/ratings", {
        method: "POST",
        body: JSON.stringify({
          orderId,
          eventId,
          subjectType,
          subjectId,
          stars,
          ...(comment.trim() ? { comment: comment.trim() } : {}),
        }),
      });
      setRated(result);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setStatus("already-rated");
      } else if (err instanceof ApiError && err.status === 400) {
        setStatus("not-eligible");
      } else {
        setError(
          err instanceof ApiError ? err.message : "Failed to submit rating",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (rated) {
    return (
      <p className={compact ? "text-xs text-green-700" : "text-sm text-green-700"}>
        {ratedLabel} {"★".repeat(rated.stars)}
        {"☆".repeat(5 - rated.stars)}
      </p>
    );
  }

  if (status === "already-rated") {
    return (
      <p className={compact ? "text-xs text-neutral-500" : "text-sm text-neutral-500"}>
        Already rated
      </p>
    );
  }

  if (status === "not-eligible") {
    return null;
  }

  const displayStars = hoverStars || stars;

  return (
    <div className={compact ? "mt-1" : "mt-3"}>
      {!compact && (
        <p className="mb-1 text-sm font-medium text-neutral-900">{label}</p>
      )}
      <div className="flex items-center gap-2">
        <div className="flex">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`${n} star${n === 1 ? "" : "s"}`}
              onMouseEnter={() => setHoverStars(n)}
              onMouseLeave={() => setHoverStars(0)}
              onClick={() => setStars(n)}
              className={`${compact ? "text-base" : "text-xl"} leading-none ${
                n <= displayStars ? "text-amber-500" : "text-neutral-300"
              }`}
            >
              ★
            </button>
          ))}
        </div>
        {compact && (
          <Button
            className="px-2 py-1 text-xs"
            disabled={stars < 1 || isSubmitting}
            onClick={handleSubmit}
          >
            {isSubmitting ? "Submitting…" : "Rate"}
          </Button>
        )}
      </div>
      {!compact && (
        <>
          <input
            placeholder="Optional comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="mt-2 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
          {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
          <Button
            className="mt-2"
            disabled={stars < 1 || isSubmitting}
            onClick={handleSubmit}
          >
            {isSubmitting ? "Submitting…" : "Submit rating"}
          </Button>
        </>
      )}
      {compact && error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
