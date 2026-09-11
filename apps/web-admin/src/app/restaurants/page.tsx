"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge, Button, Card } from "@ceylon/design-system";
import { RestaurantStatus } from "@ceylon/shared-types";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { PaginatedResult, Restaurant } from "@/lib/types";
import { Nav } from "@/components/Nav";

const STATUS_TONE: Record<RestaurantStatus, "warning" | "success" | "danger"> = {
  [RestaurantStatus.PENDING]: "warning",
  [RestaurantStatus.APPROVED]: "success",
  [RestaurantStatus.SUSPENDED]: "danger",
};

export default function RestaurantsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [restaurants, setRestaurants] = useState<Restaurant[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await apiFetch<PaginatedResult<Restaurant>>(
        "/restaurants?page=1&pageSize=50",
      );
      setRestaurants(result.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load restaurants");
    }
  }, []);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
      return;
    }
    if (user) {
      load();
    }
  }, [isLoading, user, router, load]);

  async function setStatus(id: string, status: RestaurantStatus) {
    setActioningId(id);
    setError(null);
    try {
      await apiFetch(`/restaurants/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await load();
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
          <h1 className="text-lg font-semibold text-white">
            Restaurants
          </h1>
          <Link href="/restaurants/new">
            <Button>+ New Restaurant</Button>
          </Link>
        </div>

        {error && <p className="mb-4 text-sm text-brand-400">{error}</p>}

        {restaurants === null ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : restaurants.length === 0 ? (
          <p className="text-sm text-zinc-500">No restaurants yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {restaurants.map((restaurant) => (
              <Card key={restaurant.id} className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-medium text-white">
                      {restaurant.name}
                    </h2>
                    <Badge tone={STATUS_TONE[restaurant.status]}>
                      {restaurant.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-zinc-500">
                    {restaurant.address}
                  </p>
                  <p className="text-sm text-zinc-500">
                    {restaurant.contactEmail}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link href={`/restaurants/${restaurant.id}/seat-maps`}>
                    <Button variant="secondary">Seat maps</Button>
                  </Link>
                  <Link href={`/restaurants/${restaurant.id}/events`}>
                    <Button variant="secondary">Events</Button>
                  </Link>
                  {restaurant.status === RestaurantStatus.PENDING && (
                    <Button
                      variant="primary"
                      disabled={actioningId === restaurant.id}
                      onClick={() =>
                        setStatus(restaurant.id, RestaurantStatus.APPROVED)
                      }
                    >
                      Approve
                    </Button>
                  )}
                  {restaurant.status === RestaurantStatus.APPROVED && (
                    <Button
                      variant="danger"
                      disabled={actioningId === restaurant.id}
                      onClick={() =>
                        setStatus(restaurant.id, RestaurantStatus.SUSPENDED)
                      }
                    >
                      Suspend
                    </Button>
                  )}
                  {restaurant.status === RestaurantStatus.SUSPENDED && (
                    <Button
                      variant="secondary"
                      disabled={actioningId === restaurant.id}
                      onClick={() =>
                        setStatus(restaurant.id, RestaurantStatus.APPROVED)
                      }
                    >
                      Reinstate
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
