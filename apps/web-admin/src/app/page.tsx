"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card } from "@ceylon/design-system";
import { useAuth } from "@/lib/auth-context";
import { Nav } from "@/components/Nav";

export default function DashboardPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [isLoading, user, router]);

  if (isLoading || !user) {
    return null;
  }

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <Card>
          <h1 className="text-lg font-semibold text-white">
            Welcome, {user.fullName}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">{user.email}</p>
          <div className="mt-6">
            <Link href="/restaurants">
              <Button>Manage restaurants</Button>
            </Link>
          </div>
        </Card>
      </main>
    </>
  );
}
