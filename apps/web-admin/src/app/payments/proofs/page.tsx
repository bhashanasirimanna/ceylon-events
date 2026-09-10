"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card } from "@ceylon/design-system";
import { PaymentStatus } from "@ceylon/shared-types";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { PaginatedResult, PaymentProof } from "@/lib/types";
import { Nav } from "@/components/Nav";

const STATUS_TONE: Record<PaymentStatus, "warning" | "success" | "danger"> = {
  [PaymentStatus.PENDING]: "warning",
  [PaymentStatus.APPROVED]: "success",
  [PaymentStatus.REJECTED]: "danger",
  [PaymentStatus.REFUNDED]: "danger",
};

const FILTERS: { label: string; value: PaymentStatus | "ALL" }[] = [
  { label: "Pending", value: PaymentStatus.PENDING },
  { label: "Approved", value: PaymentStatus.APPROVED },
  { label: "Rejected", value: PaymentStatus.REJECTED },
  { label: "All", value: "ALL" },
];

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString();
}

export default function PaymentProofsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [filter, setFilter] = useState<PaymentStatus | "ALL">(
    PaymentStatus.PENDING,
  );
  const [proofs, setProofs] = useState<PaymentProof[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [notesById, setNotesById] = useState<Record<string, string>>({});

  const load = useCallback(async (status: PaymentStatus | "ALL") => {
    try {
      const query = status === "ALL" ? "" : `?status=${status}`;
      const result = await apiFetch<PaginatedResult<PaymentProof>>(
        `/payments/proofs${query}&pageSize=50`.replace("?&", "?"),
      );
      setProofs(result.items);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to load payment proofs",
      );
    }
  }, []);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
      return;
    }
    if (user) {
      setProofs(null);
      load(filter);
    }
  }, [isLoading, user, router, load, filter]);

  async function review(id: string, action: "approve" | "reject") {
    setActioningId(id);
    setError(null);
    try {
      const notes = notesById[id]?.trim() || undefined;
      await apiFetch(`/payments/proofs/${id}/${action}`, {
        method: "PATCH",
        body: JSON.stringify({ notes }),
      });
      await load(filter);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action failed");
    } finally {
      setActioningId(null);
    }
  }

  if (isLoading || !user) {
    return null;
  }

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-neutral-900">
            Payment proofs
          </h1>
          <div className="flex gap-2">
            {FILTERS.map((f) => (
              <Button
                key={f.value}
                variant={filter === f.value ? "primary" : "secondary"}
                onClick={() => setFilter(f.value)}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </div>

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        {proofs === null ? (
          <p className="text-sm text-neutral-500">Loading…</p>
        ) : proofs.length === 0 ? (
          <p className="text-sm text-neutral-500">
            {filter === PaymentStatus.PENDING
              ? "No payment proofs waiting for review."
              : "No payment proofs match this filter."}
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {proofs.map((proof) => (
              <Card key={proof.id}>
                <div className="flex flex-col gap-4 sm:flex-row">
                  <img
                    src={proof.publicUrl}
                    alt="Payment proof"
                    className="max-h-64 w-full rounded-md border border-neutral-200 object-contain sm:w-64"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge tone={STATUS_TONE[proof.status]}>
                        {proof.status}
                      </Badge>
                      <span className="text-xs text-neutral-500">
                        {formatDateTime(proof.createdAt)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-mono text-neutral-500">
                      Order: {proof.orderId}
                    </p>
                    <p className="mt-1 text-sm text-neutral-700">
                      {proof.referenceNote}
                    </p>

                    {proof.status === PaymentStatus.PENDING ? (
                      <div className="mt-3 flex flex-col gap-2">
                        <textarea
                          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                          rows={2}
                          placeholder="Review notes (optional)"
                          value={notesById[proof.id] ?? ""}
                          onChange={(e) =>
                            setNotesById((prev) => ({
                              ...prev,
                              [proof.id]: e.target.value,
                            }))
                          }
                        />
                        <div className="flex gap-2">
                          <Button
                            variant="primary"
                            disabled={actioningId === proof.id}
                            onClick={() => review(proof.id, "approve")}
                          >
                            Approve
                          </Button>
                          <Button
                            variant="danger"
                            disabled={actioningId === proof.id}
                            onClick={() => review(proof.id, "reject")}
                          >
                            Reject
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 text-sm text-neutral-500">
                        {proof.reviewedAt && (
                          <p>Reviewed {formatDateTime(proof.reviewedAt)}</p>
                        )}
                        {proof.reviewNotes && (
                          <p className="mt-1 italic">
                            &ldquo;{proof.reviewNotes}&rdquo;
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
