"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import { logout } from "./actions";
import { APP_ROLES, type AppRole } from "@/lib/auth-constants";

type AppShellUser = {
  name: string;
  role: AppRole;
};

type AppShellProps = {
  children: ReactNode;
  user: AppShellUser | null;
};

type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  roles: AppRole[];
};

type IconName = "dashboard" | "call" | "gallery" | "report" | "history" | "admin" | "logout" | "menu" | "collapse";

const navItems: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: "dashboard",
    roles: [APP_ROLES.ADMIN, APP_ROLES.MANAGER, APP_ROLES.EMPLOYEE],
  },
  {
    href: "/form",
    label: "New Call",
    icon: "call",
    roles: [APP_ROLES.ADMIN, APP_ROLES.MANAGER],
  },
  {
    href: "/gallery",
    label: "Gallery",
    icon: "gallery",
    roles: [APP_ROLES.ADMIN, APP_ROLES.MANAGER],
  },
  {
    href: "/report",
    label: "Reports",
    icon: "report",
    roles: [APP_ROLES.ADMIN, APP_ROLES.MANAGER],
  },
  {
    href: "/call-history",
    label: "Call History",
    icon: "history",
    roles: [APP_ROLES.ADMIN, APP_ROLES.MANAGER],
  },
  {
    href: "/admin",
    label: "Admin Panel",
    icon: "admin",
    roles: [APP_ROLES.ADMIN],
  },
];

export function AppShell({ children, user }: AppShellProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!user || pathname === "/") {
    return <>{children}</>;
  }

  const visibleItems = navItems.filter((item) => item.roles.includes(user.role));

  return (
    <div
      className={`min-h-screen bg-[#f4f9ff] text-[#003d73] lg:grid ${
        isCollapsed ? "lg:grid-cols-[5rem_minmax(0,1fr)]" : "lg:grid-cols-[14rem_minmax(0,1fr)]"
      }`}
    >
      <aside
        className={`fixed inset-y-0 left-0 z-50 hidden overflow-hidden bg-[#0759b8] text-white shadow-[14px_0_45px_rgba(0,61,115,0.16)] transition-[width] duration-200 lg:block ${
          isCollapsed ? "w-20" : "w-56"
        }`}
      >
        <div className={`absolute inset-y-0 left-0 bg-[#06458f] transition-[width] duration-200 ${isCollapsed ? "w-20" : "w-12"}`} />
        <div className={`relative flex min-h-full flex-col py-4 ${isCollapsed ? "px-3" : "pl-3 pr-4"}`}>
          <div className={`mb-4 flex items-center ${isCollapsed ? "justify-center" : "ml-8"}`}>
            <div className={`overflow-hidden rounded-xl border border-white/25 bg-white p-1.5 shadow-sm ${isCollapsed ? "h-11 w-11" : "h-14 w-32"}`}>
              <Image
                src="/dashboard-srtec-logo.svg"
                alt="SRTEC Automation"
                width={160}
                height={72}
                className="h-full w-full object-contain"
                priority
              />
            </div>
          </div>

          <div className={`mb-4 ${isCollapsed ? "hidden" : "ml-8"}`}>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/80">{formatRole(user.role)}</p>
            <p className="mt-1 truncate text-sm font-semibold text-white">{user.name}</p>
          </div>

          <nav className="relative flex-1 space-y-1">
            <button
              type="button"
              onClick={() => setIsCollapsed((current) => !current)}
              className={`group grid w-full items-center gap-3 text-left text-sm font-semibold text-white/88 transition hover:bg-white/14 hover:text-white ${
                isCollapsed ? "grid-cols-[2.75rem] justify-center rounded-2xl px-0 py-2" : "grid-cols-[2.75rem_minmax(0,1fr)_1rem] rounded-r-full px-1 py-2"
              }`}
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <span className="flex h-10 w-10 items-center justify-center text-white/80 transition group-hover:text-white">
                <AppIcon name="collapse" />
              </span>
              <span className={`truncate ${isCollapsed ? "hidden" : ""}`}>{isCollapsed ? "Expand" : "Collapse"}</span>
              {!isCollapsed ? <span className="h-2 w-2 rounded-full bg-transparent" aria-hidden="true" /> : null}
            </button>
            {visibleItems.map((item) => (
              <SidebarLink key={item.href} item={item} active={isActivePath(pathname, item.href)} collapsed={isCollapsed} />
            ))}
          </nav>

          <form action={logout} className="relative mt-5">
            <button
              type="submit"
              className={`group grid w-full items-center gap-3 text-left text-sm font-semibold text-white/90 transition hover:bg-white hover:text-[#0759b8] ${
                isCollapsed ? "grid-cols-[2.75rem] justify-center rounded-2xl px-0 py-2" : "grid-cols-[2.75rem_minmax(0,1fr)] rounded-r-full px-1 py-2"
              }`}
              title="Logout"
            >
              <span className="flex h-10 w-10 items-center justify-center text-white/90 transition group-hover:text-[#0759b8]">
                <AppIcon name="logout" />
              </span>
              <span className={`truncate ${isCollapsed ? "hidden" : ""}`}>Logout</span>
            </button>
          </form>
        </div>
      </aside>

      <header className="sticky top-0 z-40 border-b border-blue-100 bg-white/95 px-3 py-2 shadow-sm backdrop-blur lg:hidden">
        <details className="relative">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl bg-[#0759b8] px-3 py-2 text-white">
            <span className="inline-flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
                <AppIcon name="menu" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold">SRTEC Automation</span>
                <span className="block truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-white/75">
                  {formatRole(user.role)} / {user.name}
                </span>
              </span>
            </span>
          </summary>
          <div className="absolute left-0 right-0 mt-2 overflow-hidden rounded-2xl border border-blue-100 bg-[#0759b8] p-2 shadow-2xl">
            <nav className="space-y-1">
              {visibleItems.map((item) => (
                <MobileSidebarLink key={item.href} item={item} active={isActivePath(pathname, item.href)} />
              ))}
              <form action={logout}>
                <button
                  type="submit"
                  className="grid w-full grid-cols-[2.25rem_minmax(0,1fr)] items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-white/90 hover:bg-white hover:text-[#0759b8]"
                >
                  <span className="flex h-8 w-8 items-center justify-center">
                    <AppIcon name="logout" />
                  </span>
                  <span>Logout</span>
                </button>
              </form>
            </nav>
          </div>
        </details>
      </header>

      <div className="min-w-0 lg:col-start-2">{children}</div>
    </div>
  );
}

function SidebarLink({ item, active, collapsed }: { item: NavItem; active: boolean; collapsed: boolean }) {
  return (
    <Link
      href={item.href}
      title={item.label}
      className={`group grid items-center gap-3 text-sm font-semibold transition ${
        collapsed ? "grid-cols-[2.75rem] justify-center rounded-2xl px-0 py-2" : "grid-cols-[2.75rem_minmax(0,1fr)_1rem] rounded-r-full px-1 py-2"
      } ${
        active ? "bg-white text-[#0759b8] shadow-lg shadow-blue-950/10" : "text-white/88 hover:bg-white/14 hover:text-white"
      }`}
    >
      <span
        className={`flex h-10 w-10 items-center justify-center transition ${
          active ? "text-[#0759b8]" : "text-white/80 group-hover:text-white"
        }`}
      >
        <AppIcon name={item.icon} />
      </span>
      <span className={`truncate ${collapsed ? "hidden" : ""}`}>{item.label}</span>
      {active && !collapsed ? <span className="h-2 w-2 rounded-full bg-[#0759b8]" /> : null}
    </Link>
  );
}

function MobileSidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={`grid grid-cols-[2.25rem_minmax(0,1fr)] items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${
        active ? "bg-white text-[#0759b8]" : "text-white/90 hover:bg-white/14"
      }`}
    >
      <span className="flex h-8 w-8 items-center justify-center">
        <AppIcon name={item.icon} />
      </span>
      <span>{item.label}</span>
    </Link>
  );
}

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function formatRole(role: AppRole) {
  return role.toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());
}

function AppIcon({ name }: { name: IconName }) {
  const common = {
    className: "h-5 w-5",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    viewBox: "0 0 24 24",
    "aria-hidden": true,
  };

  if (name === "dashboard") {
    return (
      <svg {...common}>
        <path d="M4 13h7V4H4v9Z" />
        <path d="M13 20h7V4h-7v16Z" />
        <path d="M4 20h7v-5H4v5Z" />
      </svg>
    );
  }

  if (name === "call") {
    return (
      <svg {...common}>
        <path d="M7 5h10" />
        <path d="M7 19h10" />
        <path d="M6 5v14" />
        <path d="M18 5v14" />
        <path d="M9 9h6" />
        <path d="M9 13h6" />
      </svg>
    );
  }

  if (name === "gallery") {
    return (
      <svg {...common}>
        <rect x="4" y="5" width="16" height="14" rx="2" />
        <path d="m7 16 3.2-3.2 2.3 2.3 1.6-1.6L18 17" />
        <path d="M15.5 9.5h.01" />
      </svg>
    );
  }

  if (name === "report") {
    return (
      <svg {...common}>
        <path d="M7 3h7l4 4v14H7V3Z" />
        <path d="M14 3v5h5" />
        <path d="M10 13h5" />
        <path d="M10 17h5" />
      </svg>
    );
  }

  if (name === "history") {
    return (
      <svg {...common}>
        <path d="M4 12a8 8 0 1 0 2.35-5.65" />
        <path d="M4 5v5h5" />
        <path d="M12 8v5l3 2" />
      </svg>
    );
  }

  if (name === "admin") {
    return (
      <svg {...common}>
        <path d="M12 3 5 6v5c0 4.2 2.9 7.9 7 9 4.1-1.1 7-4.8 7-9V6l-7-3Z" />
        <path d="M9.5 12.5 11.2 14l3.5-4" />
      </svg>
    );
  }

  if (name === "menu") {
    return (
      <svg {...common}>
        <path d="M4 7h16" />
        <path d="M4 12h16" />
        <path d="M4 17h16" />
      </svg>
    );
  }

  if (name === "collapse") {
    return (
      <svg {...common}>
        <path d="M4 6h16" />
        <path d="M4 12h16" />
        <path d="M4 18h16" />
        <path d="m15 9-3 3 3 3" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M10 17 15 12 10 7" />
      <path d="M15 12H3" />
      <path d="M21 4v16" />
    </svg>
  );
}
