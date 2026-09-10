"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@ceylon/design-system";
import { UserRole } from "@ceylon/shared-types";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { PlatformTotals } from "@/lib/types";
import { Nav } from "@/components/Nav";

const ADMIN_ROLES = new Set<string>([UserRole.SUPER_ADMIN, UserRole.ADMIN]);

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <p className="text-sm text-neutral-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-neutral-900">{value}</p>
    </Card>
  );
}

export default function PlatformReportsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [totals, setTotals] = useState<PlatformTotals | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = !!user && user.roles.some((role) => ADMIN_ROLES.has(role));

  const load = useCallback(async () => {
    try {
      const result = await apiFetch<PlatformTotals>("/reports/platform");
      setTotals(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load report");
    }
  }, []);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
      return;
    }
    if (user && isAdmin) {
      load();
    }
  }, [isLoading, user, isAdmin, router, load]);

  if (isLoading || !user) {
    return null;
  }

  if (!isAdmin) {
    return (
      <>
        <Nav />
        <main className="mx-auto max-w-3xl px-6 py-10">
          <Card>
            <p className="text-sm text-neutral-700">
              You do not have permission to view platform reports.
            </p>
          </Card>
        </main>
      </>
    );
  }

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="mb-6 text-lg font-semibold text-neutral-900">
          Platform reports
        </h1>

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        {totals === null ? (
          <p className="text-sm text-neutral-500">Loading…</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard label="Total orders" value={String(totals.totalOrders)} />
            <StatCard
              label="Confirmed orders"
              value={String(totals.confirmedOrders)}
            />
            <StatCard
              label="Total revenue"
              value={`${totals.currency} ${(totals.totalRevenueMinorUnits / 100).toFixed(2)}`}
            />
            <StatCard
              label="Restaurants"
              value={String(totals.totalRestaurants)}
            />
            <StatCard label="Events" value={String(totals.totalEvents)} />
          </div>
        )}
      </main>
    </>
  );
}
