"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, ApiError, getStoredTokens } from "@/lib/api-client";
import type { NotificationListResult, NotificationSnapshot } from "@/lib/types";

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<
    NotificationSnapshot[] | null
  >(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await apiFetch<NotificationListResult>(
        "/notifications?page=1&pageSize=20",
      );
      setNotifications(result.items);
      setUnreadCount(result.unreadCount);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to load notifications",
      );
    }
  }, []);

  useEffect(() => {
    load();

    const tokens = getStoredTokens();
    if (!tokens?.accessToken) return;

    const apiBase = `${process.env.NEXT_PUBLIC_API_BASE_URL ?? ""}/api`;
    const url = `${apiBase}/notifications/stream?token=${encodeURIComponent(tokens.accessToken)}`;
    const es = new EventSource(url);
    es.onmessage = () => {
      load();
    };
    es.onerror = () => {
      // EventSource retries connections on its own; nothing to do here.
    };
    eventSourceRef.current = es;

    return () => {
      es.close();
    };
  }, [load]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function markRead(id: string) {
    setNotifications(
      (prev) =>
        prev?.map((n) => (n.id === id && !n.readAt ? { ...n, readAt: new Date().toISOString() } : n)) ??
        prev,
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      await apiFetch(`/notifications/${id}/read`, { method: "PATCH" });
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to mark notification read",
      );
      load();
    }
  }

  async function markAllRead() {
    setNotifications((prev) => prev?.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })) ?? prev);
    setUnreadCount(0);
    try {
      await apiFetch("/notifications/read-all", { method: "PATCH" });
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to mark all as read",
      );
      load();
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative rounded-full p-2 text-neutral-600 hover:bg-neutral-100 hover:text-brand-600"
        aria-label="Notifications"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="h-5 w-5"
        >
          <path d="M12 2a6 6 0 00-6 6v3.086l-1.707 1.707A1 1 0 005 14.5h14a1 1 0 00.707-1.707L18 10.086V8a6 6 0 00-6-6zM9.5 17a2.5 2.5 0 005 0h-5z" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 z-20 mt-2 w-80 rounded-lg border border-neutral-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-neutral-100 px-3 py-2">
            <span className="text-sm font-medium text-neutral-900">
              Notifications
            </span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs text-brand-600 hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          {error && <p className="px-3 py-2 text-xs text-red-600">{error}</p>}

          <div className="max-h-96 overflow-y-auto">
            {notifications === null ? (
              <p className="px-3 py-4 text-sm text-neutral-500">Loading…</p>
            ) : notifications.length === 0 ? (
              <p className="px-3 py-4 text-sm text-neutral-500">
                No notifications yet.
              </p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => !n.readAt && markRead(n.id)}
                  className={`block w-full border-b border-neutral-50 px-3 py-2 text-left last:border-none hover:bg-neutral-50 ${
                    n.readAt ? "bg-white" : "bg-brand-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium text-neutral-900">
                      {n.title}
                    </span>
                    {!n.readAt && (
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-600" />
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-neutral-600">{n.body}</p>
                  <p className="mt-1 text-xs text-neutral-400">
                    {formatRelativeTime(n.createdAt)}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
