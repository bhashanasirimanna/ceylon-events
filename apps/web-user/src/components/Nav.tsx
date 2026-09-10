"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@ceylon/design-system";

export function Nav() {
  const { user, isLoading, logout } = useAuth();

  return (
    <header className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-lg font-semibold text-brand-600">
            Ceylon Events
          </Link>
          <Link href="/events" className="text-sm text-neutral-700">
            Events
          </Link>
        </div>
        <nav className="flex items-center gap-3">
          {isLoading ? null : user ? (
            <>
              <Link href="/orders" className="text-sm text-neutral-700">
                My orders
              </Link>
              <span className="text-sm text-neutral-700">
                {user.fullName}
              </span>
              <Button variant="ghost" onClick={logout}>
                Log out
              </Button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm text-neutral-700">
                Log in
              </Link>
              <Link href="/register">
                <Button variant="primary">Sign up</Button>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
