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
    <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-6 py-4">
      <div className="flex items-center gap-6">
        <Link
          href="/"
          className="bg-party-gradient bg-clip-text text-lg font-bold text-transparent"
        >
          Ceylon Events — Admin
        </Link>
        {user && (
          <nav className="flex gap-4 text-sm text-neutral-700">
            <Link href="/restaurants" className="hover:text-brand-600">
              Restaurants
            </Link>
            <Link href="/payments/proofs" className="hover:text-brand-600">
              Payment proofs
            </Link>
            {isAdmin && (
              <Link href="/reports" className="hover:text-brand-600">
                Reports
              </Link>
            )}
          </nav>
        )}
      </div>
      {user && (
        <div className="flex items-center gap-3 text-sm text-neutral-700">
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
