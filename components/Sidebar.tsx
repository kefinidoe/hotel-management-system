"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { RoleName } from "@prisma/client";
import {
  LayoutDashboard,
  CalendarRange,
  BedDouble,
  Users,
  Contact,
  Sparkles,
  UtensilsCrossed,
  Boxes,
  Wrench,
  Receipt,
  BarChart3,
  UserCog,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import clsx from "clsx";
import { hasRole, ROLE_GROUPS } from "@/lib/permissions";

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  roles: readonly RoleName[];
};

type NavGroup = { title: string; items: NavItem[] };

const NAV: NavGroup[] = [
  {
    title: "Overview",
    items: [
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        roles: ROLE_GROUPS.ALL_STAFF,
      },
    ],
  },
  {
    title: "Operations",
    items: [
      { label: "Front Desk", href: "/dashboard/front-desk", icon: Users, roles: ROLE_GROUPS.FRONT_DESK },
      { label: "Reservations", href: "/dashboard/reservations", icon: CalendarRange, roles: ROLE_GROUPS.GUEST_STAYS },
      { label: "Rooms", href: "/dashboard/rooms", icon: BedDouble, roles: ROLE_GROUPS.ALL_STAFF },
      { label: "Guests", href: "/dashboard/guests", icon: Contact, roles: ROLE_GROUPS.GUEST_STAYS },
      { label: "Housekeeping", href: "/dashboard/housekeeping", icon: Sparkles, roles: ROLE_GROUPS.HOUSEKEEPING },
      { label: "Maintenance", href: "/dashboard/maintenance", icon: Wrench, roles: ROLE_GROUPS.MAINTENANCE },
    ],
  },
  {
    title: "Revenue",
    items: [
      { label: "Restaurant", href: "/dashboard/restaurant", icon: UtensilsCrossed, roles: ROLE_GROUPS.RESTAURANT_POS },
      { label: "Inventory", href: "/dashboard/inventory", icon: Boxes, roles: ROLE_GROUPS.MANAGEMENT },
      { label: "Expenses", href: "/dashboard/expenses", icon: Receipt, roles: ROLE_GROUPS.ALL_STAFF },
      { label: "Reports", href: "/dashboard/reports", icon: BarChart3, roles: ROLE_GROUPS.FINANCIAL_REPORTS },
    ],
  },
  {
    title: "Administration",
    items: [
      { label: "Staff", href: "/dashboard/staff", icon: UserCog, roles: ROLE_GROUPS.STAFF_VIEW },
    ],
  },
];

export default function Sidebar({ userRole }: { userRole: RoleName }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const visibleGroups = NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => hasRole(userRole, item.roles)),
  })).filter((group) => group.items.length > 0);

  return (
    <aside
      className={clsx(
        "h-screen sticky top-0 flex flex-col border-r border-sidebar-border bg-sidebar-bg transition-all duration-300 z-30 shadow-xl",
        collapsed ? "w-[80px]" : "w-64"
      )}
    >
      <div
        className={clsx(
          "flex items-center justify-center border-b border-sidebar-border transition-all",
          collapsed ? "h-20" : "h-28"
        )}
      >
        <Link
          href="/dashboard"
          className="flex w-full items-center justify-center"
          aria-label="Axis Hotel dashboard"
        >
          <Image
            src="/axis-hotel-mark.png"
            alt="Axis Hotel Nakuru"
            width={302}
            height={312}
            priority
            className={clsx(
              "h-auto shrink-0 object-contain transition-all duration-300",
              collapsed ? "w-12" : "w-20 filter drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]"
            )}
          />
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-8 scrollbar-hide">
        {visibleGroups.map((group) => (
          <div key={group.title}>
            {!collapsed && (
              <p className="px-4 mb-3 text-[10px] font-bold uppercase tracking-[0.15em] text-sidebar-textMuted opacity-50">
                {group.title}
              </p>
            )}
            <div className="space-y-1">
              {group.items.map((item) => {
                const active = pathname === item.href || (pathname.startsWith(item.href) && item.href !== "/dashboard");
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={clsx(
                      "flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 group relative",
                      active
                        ? "bg-sidebar-active text-white shadow-[0_4px_12px_rgba(28,152,158,0.3)]"
                        : "text-sidebar-textMuted hover:bg-sidebar-hover hover:text-sidebar-text"
                    )}
                  >
                    <Icon size={19} strokeWidth={active ? 2.5 : 1.8} className={clsx("shrink-0", active ? "text-white" : "text-sidebar-textMuted group-hover:text-white")} />
                    {!collapsed && <span>{item.label}</span>}
                    {active && !collapsed && (
                      <span className="absolute right-2 w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_white]" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-sidebar-border">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex w-full items-center justify-center gap-2 py-3 rounded-xl text-sidebar-textMuted 
                     hover:bg-sidebar-hover hover:text-sidebar-text transition-all duration-200 group"
        >
          {collapsed ? <ChevronsRight size={20} /> : (
            <>
              <ChevronsLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
              <span className="text-xs font-semibold uppercase tracking-wider">Collapse Menu</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
