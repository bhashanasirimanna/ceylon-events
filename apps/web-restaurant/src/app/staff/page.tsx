"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@ceylon/design-system";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError } from "@/lib/api-client";
import { Nav } from "@/components/Nav";

export default function StaffPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    if (!user.roles.includes("RESTAURANT_OWNER")) {
      router.push("/");
    }
  }, [isLoading, user, router]);

  if (isLoading || !user || !user.restaurantId) {
    return <main className="p-6 text-sm text-zinc-500">Loading...</main>;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await apiFetch<{ tempPassword: string }>(
        "/auth/invite-restaurant-staff",
        {
          method: "POST",
          body: JSON.stringify({
            email,
            fullName,
            restaurantId: user!.restaurantId,
            role: "RESTAURANT_STAFF",
          }),
        },
      );
      setTempPassword(result.tempPassword);
      setEmail("");
      setFullName("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to invite staff");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-md px-4 py-8">
        <h1 className="mb-6 text-2xl font-semibold text-white">
          Invite Staff
        </h1>

        {tempPassword && (
          <Card className="mb-4 border-trust-700 bg-trust-500/10">
            <p className="text-sm text-trust-300">
              Staff account created. Share this temporary password with them
              — it will not be shown again:
            </p>
            <p className="mt-2 font-mono text-sm text-green-900">
              {tempPassword}
            </p>
            <Button
              variant="ghost"
              className="mt-2"
              onClick={() => setTempPassword(null)}
            >
              Dismiss
            </Button>
          </Card>
        )}

        <Card>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-300">
                Full name
              </label>
              <input
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-none border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-300">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-none border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
              />
            </div>
            {error && <p className="text-sm text-brand-400">{error}</p>}
            <Button type="submit" disabled={submitting}>
              {submitting ? "Inviting..." : "Invite staff member"}
            </Button>
          </form>
        </Card>
      </main>
    </>
  );
}
