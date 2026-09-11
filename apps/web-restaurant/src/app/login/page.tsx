"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@ceylon/design-system";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api-client";

export default function LoginPage() {
  const { login, user } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const hasRestaurantAccess = (roles: string[]) =>
    roles.includes("RESTAURANT_OWNER") || roles.includes("RESTAURANT_STAFF");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const loggedInUser = await login(email, password);
      if (!hasRestaurantAccess(loggedInUser.roles)) {
        setError("This account has no restaurant access.");
        return;
      }
      router.push("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (user && !hasRestaurantAccess(user.roles)) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center justify-center px-4">
        <Card>
          <p className="text-sm text-zinc-300">
            This account ({user.email}) has no restaurant access.
          </p>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <h1 className="mb-6 text-2xl font-bold text-brand-600">
        Ceylon Events — Restaurant
      </h1>
      <Card>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-300">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-none border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-brand-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-300">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-none border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-brand-500 focus:outline-none"
            />
          </div>
          {error && <p className="text-sm text-brand-400">{error}</p>}
          <Button type="submit" variant="party" disabled={submitting}>
            {submitting ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
