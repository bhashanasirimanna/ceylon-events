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
    <nav className="flex items-center justify-between border-b border-neutral-200 bg-white px-6 py-4">
      <div className="flex items-center gap-6">
        <span className="text-lg font-semibold text-neutral-900">
          Ceylon Events — Restaurant
        </span>
        <Link href="/" className="text-sm text-neutral-600 hover:text-brand-600">
          Home
        </Link>
        <Link
          href="/menu"
          className="text-sm text-neutral-600 hover:text-brand-600"
        >
          Menu
        </Link>
        {user?.roles.includes("RESTAURANT_OWNER") && (
          <Link
            href="/staff"
            className="text-sm text-neutral-600 hover:text-brand-600"
          >
            Staff
          </Link>
        )}
      </div>
      <div className="flex items-center gap-3">
        {user && (
          <span className="text-sm text-neutral-500">{user.fullName}</span>
        )}
        <Button variant="secondary" onClick={handleLogout}>
          Logout
        </Button>
      </div>
    </nav>
  );
}
