'use client'

import { Bell, Search, ChevronDown, Menu, X, Check, Moon, Sun } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  link: string | null;
  created_at: string;
}

interface AppHeaderProps {
  title: string;
  onMenuToggle?: () => void;
}

const typeColors: Record<string, string> = {
  success: "bg-green-500",
  warning: "bg-yellow-500",
  error: "bg-red-500",
  info: "bg-blue-500",
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const AppHeader = ({ title, onMenuToggle }: AppHeaderProps) => {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [themeMounted, setThemeMounted] = useState(false);
  useEffect(() => setThemeMounted(true), []);
  const isDark = themeMounted && resolvedTheme === "dark";
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  // Notifications via TanStack Query. The component is mounted on EVERY HR
  // page, so without caching every navigation paid for a fresh /api/notifications
  // round-trip. With staleTime=30s + the shared cache, tab-switching is free.
  const { data: notifData, isLoading: loading } = useQuery<{
    notifications: Notification[];
    unread_count: number;
  }>({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await fetch('/api/notifications');
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? 'fetch failed');
      return json.data;
    },
    // Refresh in the background every minute so the bell badge stays current
    // without us needing to poll manually.
    refetchInterval: 60_000,
  });
  const notifications = notifData?.notifications ?? [];
  const unreadCount = notifData?.unread_count ?? 0;

  // Optimistic mark-all-read: flip local cache immediately, then sync.
  const markAllReadMutation = useMutation({
    mutationFn: () => fetch('/api/notifications', { method: 'PATCH' }),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ['notifications'] });
      const prev = qc.getQueryData<typeof notifData>(['notifications']);
      qc.setQueryData(['notifications'], (old: typeof notifData) =>
        old ? { ...old, notifications: old.notifications.map(n => ({ ...n, is_read: true })), unread_count: 0 } : old
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(['notifications'], ctx.prev); },
    onSettled: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markOneReadMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/notifications/${id}`, { method: 'PATCH' }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['notifications'] });
      const prev = qc.getQueryData<typeof notifData>(['notifications']);
      qc.setQueryData(['notifications'], (old: typeof notifData) => {
        if (!old) return old;
        const wasUnread = old.notifications.find(n => n.id === id)?.is_read === false;
        return {
          ...old,
          notifications: old.notifications.map(n => n.id === id ? { ...n, is_read: true } : n),
          unread_count: Math.max(0, old.unread_count - (wasUnread ? 1 : 0)),
        };
      });
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(['notifications'], ctx.prev); },
    onSettled: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  function markAllRead() { markAllReadMutation.mutate(); }

  // Handle notification click
  function handleNotificationClick(n: Notification) {
    markOneReadMutation.mutate(n.id);
    if (n.link) {
      router.push(n.link);
    }
    setOpen(false);
  }

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="md:hidden p-2 rounded-md hover:bg-muted transition-colors"
        >
          <Menu className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="text-xl font-bold text-foreground">{title}</h1>
      </div>

      <div className="flex items-center gap-2">
        <button className="p-2 rounded-lg hover:bg-muted transition-colors">
          <Search className="h-5 w-5 text-muted-foreground" />
        </button>

        <button
          type="button"
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          onClick={() => setTheme(isDark ? "light" : "dark")}
          className="relative p-2 rounded-lg hover:bg-muted transition-colors"
        >
          <Sun
            className={`h-5 w-5 text-muted-foreground transition-all ${
              isDark ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"
            }`}
          />
          <Moon
            className={`absolute top-2 left-2 h-5 w-5 text-muted-foreground transition-all ${
              isDark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"
            }`}
          />
        </button>

        {/* Bell + Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setOpen(prev => !prev)}
            className="relative p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <Bell className="h-5 w-5 text-muted-foreground" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Dropdown Panel */}
          {open && (
            <div className="absolute right-0 top-12 w-80 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <span className="font-semibold text-sm text-foreground">
                  Notifications
                </span>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      <Check className="h-3 w-3" />
                      Mark all read
                    </button>
                  )}
                  <button
                    onClick={() => setOpen(false)}
                    className="p-1 rounded hover:bg-muted"
                  >
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>
              </div>

              {/* List */}
              <div className="max-h-80 overflow-y-auto">
                {loading ? (
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                    Loading...
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                    No notifications
                  </div>
                ) : (
                  notifications.map(n => (
                    <div
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={`flex gap-3 px-4 py-3 cursor-pointer hover:bg-muted transition-colors border-b border-border last:border-0 ${
                        !n.is_read ? 'bg-muted/40' : ''
                      }`}
                    >
                      {/* Dot */}
                      <div className="mt-1.5 flex-shrink-0">
                        <div className={`h-2 w-2 rounded-full ${typeColors[n.type] ?? 'bg-gray-400'}`} />
                      </div>
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${!n.is_read ? 'font-semibold text-foreground' : 'font-medium text-foreground'}`}>
                          {n.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {n.message}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {timeAgo(n.created_at)}
                        </p>
                      </div>
                      {/* Unread dot */}
                      {!n.is_read && (
                        <div className="mt-1.5 flex-shrink-0">
                          <div className="h-2 w-2 rounded-full bg-primary" />
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="hidden sm:flex items-center gap-2 ml-2 pl-3 border-l border-border cursor-pointer hover:bg-muted rounded-lg p-1.5 transition-colors">
          <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-xs font-semibold text-primary-foreground">
            RK
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
    </header>
  );
};

export default AppHeader;