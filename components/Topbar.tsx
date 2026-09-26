"use client";

import { Bell, HelpCircle, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import SearchBar from "@/components/SearchBar";

export default function Topbar({
  userName,
  userRole,
}: {
  userName: string;
  userRole: string;
}) {
  return (
    <header className="h-16 sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-border bg-surface/90 backdrop-blur px-6">
      <div className="flex-1 max-w-md">
        <SearchBar />
      </div>

      <div className="flex items-center gap-4">
        <button className="text-text-secondary hover:text-text-primary" title="Notifications">
          <Bell size={19} strokeWidth={1.8} />
        </button>
        <button className="text-text-secondary hover:text-text-primary" title="Help">
          <HelpCircle size={19} strokeWidth={1.8} />
        </button>

        <div className="flex items-center gap-3 pl-4 border-l border-border">
          <div className="text-right leading-tight">
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
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="Sign out"
            className="text-text-secondary hover:text-danger"
          >
            <LogOut size={18} strokeWidth={1.8} />
          </button>
        </div>
      </div>
    </header>
  );
}