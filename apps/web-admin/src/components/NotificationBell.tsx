"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError, loadTokens } from "@/lib/api-client";
import type { NotificationListResult, NotificationSnapshot } from "@/lib/types";

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffSec = Math.round(diffMs / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.round(diffHour / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationSnapshot[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
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
    if (!user) return;
    load();

    const tokens = loadTokens();
    if (!tokens?.accessToken) return;

    const apiBase = `${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000"}/api`;
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
  }, [user, load]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function markRead(notification: NotificationSnapshot) {
    if (notification.readAt) return;
    setMarkingId(notification.id);
    setError(null);
    try {
      await apiFetch(`/notifications/${notification.id}/read`, {
        method: "PATCH",
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to mark as read");
    } finally {
      setMarkingId(null);
    }
  }

  async function markAllRead() {
    setMarkingAll(true);
    setError(null);
    try {
      await apiFetch("/notifications/read-all", { method: "PATCH" });
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to mark all as read",
      );
    } finally {
      setMarkingAll(false);
    }
  }

  if (!user) return null;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        aria-label="Notifications"
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-neutral-600 hover:bg-neutral-100"
        onClick={() => setOpen((prev) => !prev)}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          className="h-5 w-5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-none text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 rounded-lg border border-neutral-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2">
            <span className="text-sm font-medium text-neutral-900">
              Notifications
            </span>
            <button
              type="button"
              className="text-xs text-brand-600 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
              disabled={markingAll || unreadCount === 0}
              onClick={markAllRead}
            >
              Mark all read
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {error && <p className="px-3 py-2 text-xs text-red-600">{error}</p>}
            {notifications.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-neutral-500">
                No notifications
              </p>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  disabled={markingId === notification.id}
                  onClick={() => markRead(notification)}
                  className={`flex w-full flex-col gap-0.5 border-b border-neutral-100 px-3 py-2 text-left last:border-b-0 hover:bg-neutral-50 disabled:cursor-not-allowed ${
                    notification.readAt ? "bg-white" : "bg-brand-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-sm ${
                        notification.readAt
                          ? "font-normal text-neutral-700"
                          : "font-semibold text-neutral-900"
                      }`}
                    >
                      {notification.title}
                    </span>
                    {!notification.readAt && (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-brand-600" />
                    )}
                  </div>
                  <p className="text-xs text-neutral-500">{notification.body}</p>
                  <p className="text-[11px] text-neutral-400">
                    {formatRelativeTime(notification.createdAt)}
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
