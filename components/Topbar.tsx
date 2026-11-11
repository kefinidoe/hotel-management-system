"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, HelpCircle, KeyRound, LogOut, CheckCheck, User, Settings } from "lucide-react";
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
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

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
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
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
      <header className="h-20 sticky top-0 z-20 flex items-center justify-between gap-6 border-b border-border bg-surface/80 backdrop-blur-md px-8 shadow-sm">
        <div className="flex-1 max-w-lg">
          {canSearchGuests && <SearchBar />}
        </div>

        <div className="flex items-center gap-2">
          {/* Notifications */}
          <div className="relative" ref={notificationRef}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className={clsx(
                "relative p-2.5 rounded-xl transition-all duration-200",
                showNotifications 
                  ? "bg-teal-50 text-teal-600 shadow-inner" 
                  : "text-text-secondary hover:text-navy-500 hover:bg-bg"
              )}
              title="Notifications"
            >
              <Bell size={21} strokeWidth={1.8} />
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white ring-2 ring-surface animate-bounce">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-3 w-80 rounded-2xl border border-border bg-surface shadow-popover overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                <div className="flex items-center justify-between p-4 border-b border-border bg-bg/30">
                  <h3 className="text-sm font-bold text-navy-500">Notifications</h3>
                  {unreadCount > 0 && (
                    <button
                      onClick={() => markAsRead(undefined, true)}
                      className="text-[11px] font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-teal-50 transition-colors"
                    >
                      <CheckCheck size={14} />
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-[400px] overflow-y-auto scrollbar-hide">
                  {notifications.length === 0 ? (
                    <div className="p-10 text-center">
                      <div className="mx-auto w-12 h-12 bg-bg rounded-full flex items-center justify-center text-text-muted mb-3">
                        <Bell size={24} />
                      </div>
                      <p className="text-sm font-medium text-text-secondary">All caught up!</p>
                      <p className="text-xs text-text-muted mt-1">No new notifications.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border/50">
                      {notifications.map((n) => (
                        <div
                          key={n.id}
                          className={clsx(
                            "p-4 transition-all hover:bg-bg/40 cursor-pointer relative group",
                            !n.isRead && "bg-teal-50/20"
                          )}
                          onClick={() => !n.isRead && markAsRead(n.id)}
                        >
                          {!n.isRead && (
                            <span className="absolute left-0 top-0 bottom-0 w-1 bg-teal-500 rounded-r-full" />
                          )}
                          <div className="flex flex-col gap-1">
                            <p className={clsx("text-[13px]", n.isRead ? "text-text-primary font-medium" : "text-navy-700 font-bold")}>
                              {n.title}
                            </p>
                            {n.body && <p className="text-xs text-text-secondary leading-relaxed line-clamp-2 pr-2">{n.body}</p>}
                            <p className="text-[10px] text-text-muted mt-1 font-bold uppercase tracking-wider flex items-center gap-1.5">
                              <span className="w-1 h-1 rounded-full bg-border" />
                              {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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

          <button className="text-text-secondary hover:text-navy-500 p-2.5 rounded-xl hover:bg-bg transition-all duration-200" title="Help Center">
            <HelpCircle size={21} strokeWidth={1.8} />
          </button>

          {/* Profile Dropdown */}
          <div className="relative ml-2 pl-4 border-l border-border" ref={profileRef}>
            <button 
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-3 p-1 rounded-xl hover:bg-bg transition-all duration-200 group"
            >
              <div className="text-right leading-tight hidden sm:block">
                <p className="text-sm font-bold text-navy-500 group-hover:text-navy-600 transition-colors">{userName}</p>
                <p className="text-[10px] font-bold text-gold-600 uppercase tracking-widest mt-0.5">
                  {userRole.replace("_", " ")}
                </p>
              </div>
              <div
                className="h-10 w-10 rounded-xl bg-navy-500 text-white flex items-center justify-center
                           text-sm font-bold shadow-sm transition-transform duration-200 group-active:scale-95 group-hover:shadow-md"
              >
                {userName.charAt(0).toUpperCase()}
              </div>
            </button>

            {showProfileMenu && (
              <div className="absolute right-0 mt-3 w-56 rounded-2xl border border-border bg-surface shadow-popover overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                <div className="p-4 border-b border-border bg-bg/20 sm:hidden">
                  <p className="text-sm font-bold text-navy-500">{userName}</p>
                  <p className="text-[10px] font-bold text-gold-600 uppercase tracking-widest mt-0.5">{userRole}</p>
                </div>
                <div className="p-1.5">
                  <button
                    onClick={() => { setChangePasswordOpen(true); setShowProfileMenu(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-text-secondary hover:text-navy-500 hover:bg-bg rounded-xl transition-all"
                  >
                    <KeyRound size={18} className="text-text-muted" />
                    Change Password
                  </button>
                  <button
                    onClick={() => { /* Placeholder for Profile Settings */ setShowProfileMenu(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-text-secondary hover:text-navy-500 hover:bg-bg rounded-xl transition-all"
                  >
                    <User size={18} className="text-text-muted" />
                    My Profile
                  </button>
                  <div className="h-px bg-border my-1.5 mx-2" />
                  <button
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-bold text-danger hover:bg-danger-bg rounded-xl transition-all"
                  >
                    <LogOut size={18} />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
