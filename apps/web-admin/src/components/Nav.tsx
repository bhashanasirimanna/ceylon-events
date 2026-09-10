"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@ceylon/design-system";
import { useAuth } from "@/lib/auth-context";

export function Nav() {
  const { user, logout } = useAuth();
  const router = useRouter();

  return (
    <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-6 py-4">
      <div className="flex items-center gap-6">
        <Link href="/" className="text-lg font-semibold text-neutral-900">
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
          </nav>
        )}
      </div>
      {user && (
        <div className="flex items-center gap-3 text-sm text-neutral-700">
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
