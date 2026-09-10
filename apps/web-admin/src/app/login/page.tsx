"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@ceylon/design-system";
import { UserRole } from "@ceylon/shared-types";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api-client";

const ADMIN_ROLES = new Set<string>([UserRole.SUPER_ADMIN, UserRole.ADMIN]);

export default function LoginPage() {
  const { user, isLoading, login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && user && user.roles.some((role) => ADMIN_ROLES.has(role))) {
      router.push("/");
    }
  }, [isLoading, user, router]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const loggedInUser = await login(email, password);
      const hasAdminRole = loggedInUser.roles.some((role) =>
        ADMIN_ROLES.has(role),
      );
      if (!hasAdminRole) {
        setError(
          "This account does not have admin access to the platform console.",
        );
        return;
      }
      router.push("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (!isLoading && user) {
    const hasAdminRole = user.roles.some((role) => ADMIN_ROLES.has(role));
    if (!hasAdminRole) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <Card className="max-w-sm text-center">
            <p className="text-sm text-neutral-700">
              Signed in as <strong>{user.email}</strong>, but this account
              does not have admin access to the platform console.
            </p>
          </Card>
        </div>
      );
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50">
      <Card className="w-full max-w-sm">
        <h1 className="mb-4 text-xl font-semibold text-neutral-900">
          Ceylon Events — Admin
        </h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-neutral-700">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-neutral-700">
            Password
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
