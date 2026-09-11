"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Badge,
  Button,
  Card,
  QRScanner,
  fireConfetti,
  usePrefersReducedMotion,
} from "@ceylon/design-system";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError } from "@/lib/api-client";
import { Nav } from "@/components/Nav";

interface TicketLookupResult {
  id: string;
  eventTitle: string;
  ticketTierId: string;
  seatLabel: string | null;
  status: "ISSUED" | "CHECKED_IN";
  checkedInAt: string | null;
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString();
}

export default function CheckInPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [token, setToken] = useState("");
  const [ticket, setTicket] = useState<TicketLookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [scanMode, setScanMode] = useState<"manual" | "camera">("manual");
  const prefersReducedMotion = usePrefersReducedMotion();

  const authorized =
    !!user &&
    (user.roles.includes("RESTAURANT_OWNER") ||
      user.roles.includes("RESTAURANT_STAFF"));

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.push("/login");
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!isLoading && authorized) {
      inputRef.current?.focus();
    }
  }, [isLoading, authorized]);

  function resetForNextScan() {
    setToken("");
    setTicket(null);
    setSuccessBanner(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  async function performLookup(rawToken: string) {
    const trimmed = rawToken.trim();
    if (!trimmed) return;
    setError(null);
    setSuccessBanner(false);
    setTicket(null);
    setIsLookingUp(true);
    try {
      const result = await apiFetch<TicketLookupResult>(
        `/tickets/${encodeURIComponent(trimmed)}/lookup`,
      );
      setTicket(result);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 404) {
          setError("Ticket not found — check the code and try again.");
        } else if (err.statusCode === 403) {
          setError("This ticket isn't for an event at your restaurant.");
        } else {
          setError(err.message);
        }
      } else {
        setError("Failed to look up ticket");
      }
    } finally {
      setIsLookingUp(false);
    }
  }

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    await performLookup(token);
  }

  function handleCameraScan(value: string) {
    setToken(value);
    performLookup(value);
  }

  async function handleConfirmCheckIn() {
    if (!ticket) return;
    setError(null);
    setIsCheckingIn(true);
    try {
      const result = await apiFetch<TicketLookupResult>(
        `/tickets/${encodeURIComponent(token.trim())}/check-in`,
        { method: "POST" },
      );
      setTicket(result);
      setSuccessBanner(true);
      fireConfetti({ reducedMotion: prefersReducedMotion });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 409) {
          setError(err.message);
          // Reflect the now-stale local state so the button disappears.
          setTicket((prev) =>
            prev ? { ...prev, status: "CHECKED_IN" } : prev,
          );
        } else if (err.statusCode === 404) {
          setError("Ticket not found — check the code and try again.");
        } else if (err.statusCode === 403) {
          setError("This ticket isn't for an event at your restaurant.");
        } else {
          setError(err.message);
        }
      } else {
        setError("Failed to check in ticket");
      }
    } finally {
      setIsCheckingIn(false);
    }
  }

  if (isLoading || !user) {
    return <main className="p-6 text-sm text-zinc-500">Loading...</main>;
  }

  if (!authorized) {
    return (
      <>
        <Nav />
        <main className="mx-auto max-w-md px-4 py-8">
          <p className="text-sm text-zinc-500">
            Check-in is only available to restaurant owners and staff.
          </p>
        </main>
      </>
    );
  }

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-md px-4 py-8">
        <h1 className="mb-2 text-2xl font-black uppercase tracking-tightest text-white">
          Door Check-In
        </h1>
        <p className="mb-4 text-sm text-zinc-500">
          Scan a ticket&apos;s QR code with a USB scanner (it types into the
          field below like a keyboard), paste the code manually, or use your
          device&apos;s camera.
        </p>

        <div className="mb-4 flex gap-2">
          <Button
            variant={scanMode === "manual" ? "primary" : "secondary"}
            onClick={() => setScanMode("manual")}
          >
            Manual / USB scanner
          </Button>
          <Button
            variant={scanMode === "camera" ? "primary" : "secondary"}
            onClick={() => setScanMode("camera")}
          >
            Camera
          </Button>
        </div>

        {scanMode === "camera" ? (
          <div className="mb-6">
            <QRScanner
              onScan={handleCameraScan}
              active={!ticket}
              className="mx-auto max-w-xs"
            />
          </div>
        ) : (
          <form onSubmit={handleLookup} className="mb-6 flex gap-2">
            <input
              ref={inputRef}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Scan or paste ticket code"
              autoFocus
              className="flex-1 rounded-none border border-zinc-700 bg-black/40 px-3 py-3 text-base text-white placeholder:text-zinc-500"
            />
            <Button type="submit" disabled={isLookingUp || !token.trim()}>
              {isLookingUp ? "Looking up..." : "Look up"}
            </Button>
          </form>
        )}

        {error && (
          <Card className="mb-4 border-brand-800 bg-brand-600/10">
            <p className="text-sm text-brand-300">{error}</p>
          </Card>
        )}

        {successBanner && (
          <Card className="mb-4 border-trust-700 bg-trust-500/10">
            <p className="text-sm font-medium text-trust-300">
              ✓ Checked in successfully
            </p>
          </Card>
        )}

        {ticket && (
          <Card className="mb-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-bold text-white">
                {ticket.eventTitle}
              </h2>
              <Badge
                tone={
                  ticket.status === "CHECKED_IN" ? "warning" : "success"
                }
              >
                {ticket.status === "CHECKED_IN"
                  ? "Already checked in"
                  : "Issued"}
              </Badge>
            </div>
            <p className="text-sm text-zinc-400">
              {ticket.seatLabel
                ? `Seat: ${ticket.seatLabel}`
                : "General Admission"}
            </p>
            {ticket.checkedInAt && (
              <p className="mt-1 text-xs text-zinc-500">
                Checked in at {formatTimestamp(ticket.checkedInAt)}
              </p>
            )}

            {ticket.status === "ISSUED" && (
              <Button
                className="mt-4 w-full"
                onClick={handleConfirmCheckIn}
                disabled={isCheckingIn}
              >
                {isCheckingIn ? "Checking in..." : "Confirm Check-In"}
              </Button>
            )}
          </Card>
        )}

        {(ticket || error) && (
          <Button variant="secondary" className="w-full" onClick={resetForNextScan}>
            Scan next ticket
          </Button>
        )}
      </main>
    </>
  );
}
