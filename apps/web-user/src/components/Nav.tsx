"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@ceylon/design-system";
import { NotificationBell } from "@/components/NotificationBell";

export function Nav() {
  const { user, isLoading, logout } = useAuth();

  return (
    <header className="border-b border-zinc-900 bg-surface-base">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="font-black uppercase tracking-tightest text-white"
          >
            Ceylon<span className="text-brand-500">Events</span>
          </Link>
          <Link
            href="/events"
            className="font-mono text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-white"
          >
            Events
          </Link>
        </div>
        <nav className="flex items-center gap-4">
          {isLoading ? null : user ? (
            <>
              <Link
                href="/orders"
                className="font-mono text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-white"
              >
                My orders
              </Link>
              <NotificationBell />
              <span className="text-sm font-medium text-zinc-400">
                {user.fullName}
              </span>
              <Button variant="ghost" onClick={logout}>
                Log out
              </Button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="font-mono text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-white"
              >
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
