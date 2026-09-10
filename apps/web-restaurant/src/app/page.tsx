"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Badge } from "@ceylon/design-system";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api-client";
import { Nav } from "@/components/Nav";

interface RestaurantProfile {
  id: string;
  name: string;
  description: string | null;
  address: string;
  status: "PENDING" | "APPROVED" | "SUSPENDED";
}

const statusTone: Record<RestaurantProfile["status"], "warning" | "success" | "danger"> = {
  PENDING: "warning",
  APPROVED: "success",
  SUSPENDED: "danger",
};

export default function HomePage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [restaurant, setRestaurant] = useState<RestaurantProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    if (!user.restaurantId) return;
    apiFetch<RestaurantProfile>(`/restaurants/${user.restaurantId}`)
      .then(setRestaurant)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load restaurant"));
  }, [isLoading, user, router]);

  if (isLoading || !user) {
    return <main className="p-6 text-sm text-neutral-500">Loading...</main>;
  }

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-4 text-2xl font-semibold text-neutral-900">
          Welcome, {user.fullName}
        </h1>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {restaurant && (
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-medium text-neutral-900">
                  {restaurant.name}
                </h2>
                <p className="text-sm text-neutral-600">{restaurant.address}</p>
              </div>
              <Badge tone={statusTone[restaurant.status]}>
                {restaurant.status}
              </Badge>
            </div>
          </Card>
        )}
        <p className="mt-6 text-sm text-neutral-600">
          Use the Menu tab to manage your categories and items.
        </p>
      </main>
    </>
  );
}
