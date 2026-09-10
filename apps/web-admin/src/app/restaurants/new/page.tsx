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
    try {
      await apiFetch("/restaurants", {
        method: "POST",
        body: JSON.stringify(form),
      });
      router.push("/restaurants");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create restaurant");
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
          <h1 className="mb-4 text-lg font-semibold text-neutral-900">
            New Restaurant
          </h1>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm text-neutral-700">
              Name
              <input
                required
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-neutral-700">
              Description
              <textarea
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-neutral-700">
              Address
              <input
                required
                value={form.address}
                onChange={(e) => update("address", e.target.value)}
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-neutral-700">
              Contact email
              <input
                type="email"
                required
                value={form.contactEmail}
                onChange={(e) => update("contactEmail", e.target.value)}
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-neutral-700">
              Contact phone
              <input
                value={form.contactPhone}
                onChange={(e) => update("contactPhone", e.target.value)}
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating…" : "Create restaurant"}
            </Button>
          </form>
        </Card>
      </main>
    </>
  );
}
