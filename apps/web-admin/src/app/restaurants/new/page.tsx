"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@ceylon/design-system";
import type { CreateRestaurantDto } from "@ceylon/shared-types";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError } from "@/lib/api-client";
import { Nav } from "@/components/Nav";

export default function NewRestaurantPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState<CreateRestaurantDto>({
    name: "",
    description: "",
    address: "",
    contactEmail: "",
    contactPhone: "",
  });
  const [ownerFullName, setOwnerFullName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [isLoading, user, router]);

  function update<K extends keyof CreateRestaurantDto>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    let restaurant: { id: string };
    try {
      restaurant = await apiFetch<{ id: string }>("/restaurants", {
        method: "POST",
        body: JSON.stringify(form),
      });
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to create restaurant",
      );
      setSubmitting(false);
      return;
    }
    try {
      await apiFetch("/auth/invite-restaurant-owner", {
        method: "POST",
        body: JSON.stringify({
          email: ownerEmail,
          fullName: ownerFullName,
          restaurantId: restaurant.id,
        }),
      });
      router.push("/restaurants");
    } catch (err) {
      setError(
        `The restaurant was created, but sending the owner invite failed: ${
          err instanceof ApiError ? err.message : "unknown error"
        }`,
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading || !user) {
    return null;
  }

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-lg px-6 py-10">
        <Card>
          <h1 className="mb-4 text-lg font-semibold text-white">
            New Restaurant
          </h1>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm text-zinc-300">
              Name
              <input
                required
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                className="rounded-none border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-zinc-300">
              Description
              <textarea
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                className="rounded-none border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-zinc-300">
              Address
              <input
                required
                value={form.address}
                onChange={(e) => update("address", e.target.value)}
                className="rounded-none border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-zinc-300">
              Contact email
              <input
                type="email"
                required
                value={form.contactEmail}
                onChange={(e) => update("contactEmail", e.target.value)}
                className="rounded-none border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-zinc-300">
              Contact phone
              <input
                value={form.contactPhone}
                onChange={(e) => update("contactPhone", e.target.value)}
                className="rounded-none border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
              />
            </label>

            <div className="mt-2 border-t border-zinc-800 pt-3">
              <p className="mb-2 text-sm font-medium text-white">
                Restaurant owner
              </p>
              <p className="mb-3 text-xs text-zinc-500">
                They&apos;ll get an email with a link to set their password
                and activate their web-restaurant login.
              </p>
              <label className="flex flex-col gap-1 text-sm text-zinc-300">
                Owner full name
                <input
                  required
                  value={ownerFullName}
                  onChange={(e) => setOwnerFullName(e.target.value)}
                  className="rounded-none border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
                />
              </label>
              <label className="mt-3 flex flex-col gap-1 text-sm text-zinc-300">
                Owner email
                <input
                  type="email"
                  required
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  className="rounded-none border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
                />
              </label>
            </div>

            {error && <p className="text-sm text-brand-400">{error}</p>}
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating…" : "Create restaurant"}
            </Button>
          </form>
        </Card>
      </main>
    </>
  );
}
