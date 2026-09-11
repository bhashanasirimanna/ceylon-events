"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@ceylon/design-system";
import { UserRole } from "@ceylon/shared-types";
import { useAuth } from "@/lib/auth-context";
import { NotificationBell } from "./NotificationBell";

const ADMIN_ROLES = new Set<string>([UserRole.SUPER_ADMIN, UserRole.ADMIN]);

export function Nav() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const isAdmin = !!user && user.roles.some((role) => ADMIN_ROLES.has(role));

  return (
    <header className="flex items-center justify-between border-b border-zinc-900 bg-surface-base px-6 py-4">
      <div className="flex items-center gap-6">
        <Link
          href="/"
          className="font-black uppercase tracking-tightest text-white"
        >
          Ceylon<span className="text-brand-500">Events</span>{" "}
          <span className="text-zinc-600">/ Admin</span>
        </Link>
        {user && (
          <nav className="flex gap-4 font-mono text-xs font-bold uppercase tracking-widest text-zinc-400">
            <Link href="/restaurants" className="hover:text-white">
              Restaurants
            </Link>
            <Link href="/payments/proofs" className="hover:text-white">
              Payment proofs
            </Link>
            {isAdmin && (
              <Link href="/reports" className="hover:text-white">
                Reports
              </Link>
            )}
          </nav>
        )}
      </div>
      {user && (
        <div className="flex items-center gap-3 text-sm text-zinc-300">
          <NotificationBell />
          <span>{user.fullName}</span>
          <Button
            variant="ghost"
            onClick={() => {
              logout();
              router.push("/login");
            }}
          >
            Log out
          </Button>
        </div>
      )}
    </header>
  );
}
