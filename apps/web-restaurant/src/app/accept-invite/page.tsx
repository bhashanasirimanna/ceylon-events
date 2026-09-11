"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button, Card } from "@ceylon/design-system";
import { apiFetch, ApiError } from "@/lib/api-client";

function AcceptInviteForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activated, setActivated] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch("/auth/accept-invite", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      setActivated(true);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to activate account",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <Card>
        <p className="text-sm text-neutral-700">
          This invite link is missing its token. Ask whoever invited you to
          resend it.
        </p>
      </Card>
    );
  }

  if (activated) {
    return (
      <Card glow>
        <p className="text-sm text-neutral-900">
          Your account is activated! Log in with your new password to get
          started.
        </p>
        <Link href="/login" className="mt-3 inline-block">
          <Button variant="party">Go to login</Button>
        </Link>
      </Card>
    );
  }

  return (
    <Card>
      <h1 className="mb-1 bg-party-gradient bg-clip-text text-xl font-bold text-transparent">
        Activate your account
      </h1>
      <p className="mb-4 text-sm text-neutral-500">
        Set a password to start managing your restaurant.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          Password
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          Confirm password
          <input
            type="password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" variant="party" disabled={submitting}>
          {submitting ? "Activating…" : "Activate account"}
        </Button>
      </form>
    </Card>
  );
}

export default function AcceptInvitePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <Suspense fallback={null}>
        <AcceptInviteForm />
      </Suspense>
    </main>
  );
}
