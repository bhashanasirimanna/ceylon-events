"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@ceylon/design-system";
import { useAuth } from "@/lib/auth-context";

export function Nav() {
  const { user, logout } = useAuth();
  const router = useRouter();

  function handleLogout() {
    logout();
    router.push("/login");
  }

  return (
    <nav className="flex items-center justify-between border-b border-zinc-900 bg-surface-base px-6 py-4">
      <div className="flex items-center gap-6">
        <span className="font-black uppercase tracking-tightest text-white">
          Ceylon<span className="text-brand-500">Events</span>{" "}
          <span className="text-zinc-600">/ Restaurant</span>
        </span>
        <Link
          href="/"
          className="font-mono text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-white"
        >
          Home
        </Link>
        <Link
          href="/menu"
          className="font-mono text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-white"
        >
          Menu
        </Link>
        {(user?.roles.includes("RESTAURANT_OWNER") ||
          user?.roles.includes("RESTAURANT_STAFF")) && (
          <Link
            href="/check-in"
            className="font-mono text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-white"
          >
            Check-in
          </Link>
        )}
        {(user?.roles.includes("RESTAURANT_OWNER") ||
          user?.roles.includes("RESTAURANT_STAFF")) && (
          <Link
            href="/food-orders"
            className="font-mono text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-white"
          >
            Food orders
          </Link>
        )}
        {(user?.roles.includes("RESTAURANT_OWNER") ||
          user?.roles.includes("RESTAURANT_STAFF")) && (
          <Link
            href="/offers"
            className="font-mono text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-white"
          >
            Offers
          </Link>
        )}
        {(user?.roles.includes("RESTAURANT_OWNER") ||
          user?.roles.includes("RESTAURANT_STAFF")) && (
          <Link
            href="/reports"
            className="font-mono text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-white"
          >
            Reports
          </Link>
        )}
        {user?.roles.includes("RESTAURANT_OWNER") && (
          <Link
            href="/staff"
            className="font-mono text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-white"
          >
            Staff
          </Link>
        )}
      </div>
      <div className="flex items-center gap-3">
        {user && (
          <span className="text-sm text-zinc-500">{user.fullName}</span>
        )}
        <Button variant="secondary" onClick={handleLogout}>
          Logout
        </Button>
      </div>
    </nav>
  );
}
