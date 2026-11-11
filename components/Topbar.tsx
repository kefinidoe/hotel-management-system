"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, HelpCircle, KeyRound, LogOut, CheckCheck } from "lucide-react";
import { signOut } from "next-auth/react";
import type { RoleName } from "@prisma/client";
import SearchBar from "@/components/SearchBar";
import ChangePasswordModal from "@/components/ChangePasswordModal";
import { hasRole, ROLE_GROUPS } from "@/lib/permissions";
import clsx from "clsx";

interface Notification {
  id: string;
  title: string;
  body: string | null;
  isRead: boolean;
  createdAt: string;
}

export default function Topbar({
  userName,
  userRole,
}: {
  userName: string;
  userRole: RoleName;
}) {
  const canSearchGuests = hasRole(userRole, ROLE_GROUPS.FRONT_DESK);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // Poll every 30 seconds
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markAsRead = async (id?: string, all = false) => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, all }),
      });
      fetchNotifications();
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  return (
    <>
      {changePasswordOpen && <ChangePasswordModal onClose={() => setChangePasswordOpen(false)} />}
      <header className="h-16 sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-border bg-surface/90 backdrop-blur px-6">
        <div className="flex-1 max-w-md">
          {canSearchGuests && <SearchBar />}
        </div>
        <div className="flex items-center gap-4">
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className={clsx(
                "relative p-2 rounded-full transition-colors",
                showNotifications ? "bg-primary-50 text-primary-600" : "text-text-secondary hover:text-text-primary hover:bg-bg"
              )}
              title="Notifications"
            >
              <Bell size={20} strokeWidth={1.8} />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white ring-2 ring-surface">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 rounded-xl border border-border bg-surface shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-center justify-between p-4 border-b border-border bg-bg/50">
                  <h3 className="text-sm font-semibold text-text-primary">Notifications</h3>
                  {unreadCount > 0 && (
                    <button
                      onClick={() => markAsRead(undefined, true)}
                      className="text-[11px] font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1"
                    >
                      <CheckCheck size={12} />
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-[360px] overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center">
                      <p className="text-sm text-text-muted">No notifications yet</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {notifications.map((n) => (
                        <div
                          key={n.id}
                          className={clsx(
                            "p-4 transition-colors hover:bg-bg/50 cursor-pointer relative",
                            !n.isRead && "bg-primary-50/30"
                          )}
                          onClick={() => !n.isRead && markAsRead(n.id)}
                        >
                          {!n.isRead && (
                            <span className="absolute left-1.5 top-5 h-1.5 w-1.5 rounded-full bg-primary-500" />
                          )}
                          <div className="flex flex-col gap-0.5">
                            <p className={clsx("text-sm", n.isRead ? "text-text-primary font-medium" : "text-primary-900 font-semibold")}>
                              {n.title}
                            </p>
                            {n.body && <p className="text-xs text-text-secondary leading-relaxed line-clamp-2">{n.body}</p>}
                            <p className="text-[10px] text-text-muted mt-1 uppercase tracking-wider">
                              {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {new Date(n.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          <button className="text-text-secondary hover:text-text-primary p-2 rounded-full hover:bg-bg transition-colors" title="Help">
            <HelpCircle size={20} strokeWidth={1.8} />
          </button>
          <div className="flex items-center gap-3 pl-4 border-l border-border">
            <div className="text-right leading-tight hidden sm:block">
              <p className="text-sm font-medium text-text-primary">{userName}</p>
              <p className="text-xs text-text-secondary capitalize">
                {userRole.toLowerCase().replace("_", " ")}
              </p>
            </div>
            <div
              className="h-9 w-9 rounded-full bg-primary-500 text-white flex items-center justify-center
                         text-sm font-semibold shrink-0"
            >
              {userName.charAt(0).toUpperCase()}
            </div>
            <button
              onClick={() => setChangePasswordOpen(true)}
              title="Change my password"
              className="text-text-secondary hover:text-primary-600 p-2 rounded-full hover:bg-bg transition-colors"
            >
              <KeyRound size={18} strokeWidth={1.8} />
            </button>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              title="Sign out"
              className="text-text-secondary hover:text-danger p-2 rounded-full hover:bg-bg transition-colors"
            >
              <LogOut size={18} strokeWidth={1.8} />
            </button>
          </div>
        </div>
      </header>
    </>
  );
}
