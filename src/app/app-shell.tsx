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

type ManualItem = {
  href: string;
  label: string;
  description: string;
};

type IconName = "dashboard" | "call" | "gallery" | "report" | "history" | "admin" | "gear" | "folder" | "logout" | "menu" | "collapse";

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
    roles: [APP_ROLES.ADMIN, APP_ROLES.MANAGER],
  },
];

const techManualItems: ManualItem[] = [
  { href: "/tech-manual/safety", label: "Safety", description: "Site safety guides and handling procedures" },
  { href: "/tech-manual/security", label: "Security", description: "Security setup, wiring, and service references" },
  { href: "/tech-manual/automation", label: "Automation", description: "Automation product manuals and install notes" },
];

export function AppShell({ children, user }: AppShellProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isTechManualOpen, setIsTechManualOpen] = useState(false);

  if (!user || pathname === "/") {
    return <>{children}</>;
  }

  const visibleItems = navItems.filter((item) => item.roles.includes(user.role));
  const canSeeTechManual = [APP_ROLES.ADMIN, APP_ROLES.MANAGER, APP_ROLES.EMPLOYEE].includes(user.role);

  return (
    <div
      className={`min-h-screen bg-[#f4f9ff] text-[#003d73] lg:grid ${
        isCollapsed ? "lg:grid-cols-[5.5rem_minmax(0,1fr)]" : "lg:grid-cols-[15rem_minmax(0,1fr)]"
      }`}
    >
      <aside
        className={`fixed inset-y-0 left-0 z-50 hidden overflow-hidden bg-gradient-to-b from-[#0759b8] via-[#064f9f] to-[#04356f] text-white shadow-[14px_0_45px_rgba(0,61,115,0.16)] transition-[width] duration-200 lg:block ${
          isCollapsed ? "w-[5.5rem]" : "w-60"
        }`}
      >
        <div className={`relative flex h-full min-h-0 flex-col py-3 ${isCollapsed ? "px-3" : "px-4"}`}>
          <div className="mb-3 flex shrink-0 justify-center">
            <div className={`overflow-hidden rounded-xl border border-white/25 bg-white p-1.5 shadow-sm ${isCollapsed ? "h-10 w-10" : "h-12 w-28"}`}>
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

          <div className={`mb-3 shrink-0 rounded-2xl border border-white/10 bg-white/10 px-3 py-2 shadow-sm ${isCollapsed ? "hidden" : ""}`}>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/80">{formatRole(user.role)}</p>
            <p className="mt-0.5 truncate text-xs font-semibold text-white">{user.name}</p>
          </div>

          <nav className="relative min-h-0 flex-1 space-y-1">
            <button
              type="button"
              onClick={() => setIsCollapsed((current) => !current)}
              className={`group grid w-full items-center gap-2 rounded-xl text-left text-xs font-semibold text-white/92 transition hover:bg-white/14 hover:text-white ${
                isCollapsed ? "grid-cols-[2.25rem] justify-center px-0 py-1" : "grid-cols-[2.25rem_minmax(0,1fr)_0.75rem] px-2 py-1"
              }`}
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white transition group-hover:bg-white/18">
                <AppIcon name="collapse" />
              </span>
              <span className={`truncate ${isCollapsed ? "hidden" : ""}`}>{isCollapsed ? "Expand" : "Collapse"}</span>
              {!isCollapsed ? <span className="h-2 w-2 rounded-full bg-transparent" aria-hidden="true" /> : null}
            </button>
            {visibleItems.map((item) => (
              <SidebarLink key={item.href} item={item} active={isActivePath(pathname, item.href)} collapsed={isCollapsed} />
            ))}
            {canSeeTechManual ? (
              <TechManualNav
                activePath={pathname}
                collapsed={isCollapsed}
                onOpen={() => setIsTechManualOpen(true)}
              />
            ) : null}
          </nav>

          <form action={logout} className="relative mt-3 shrink-0">
            <button
              type="submit"
              className={`group grid w-full items-center gap-2 rounded-xl text-left text-xs font-semibold text-white/95 transition hover:bg-white hover:text-[#0759b8] ${
                isCollapsed ? "grid-cols-[2.25rem] justify-center px-0 py-1" : "grid-cols-[2.25rem_minmax(0,1fr)] px-2 py-1"
              }`}
              title="Logout"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white transition group-hover:bg-blue-50 group-hover:text-[#0759b8]">
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
              {canSeeTechManual ? (
                <MobileTechManualNav activePath={pathname} onOpen={() => setIsTechManualOpen(true)} />
              ) : null}
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

      {isTechManualOpen ? <TechManualPopup onClose={() => setIsTechManualOpen(false)} /> : null}

      <div className="min-w-0 lg:col-start-2">{children}</div>
    </div>
  );
}

function TechManualNav({
  activePath,
  collapsed,
  onOpen,
}: {
  activePath: string;
  collapsed: boolean;
  onOpen: () => void;
}) {
  const active = isActivePath(activePath, "/tech-manual");

  return (
    <div>
      <button
        type="button"
        onClick={onOpen}
        title="Tech Manual"
        className={`group grid w-full items-center gap-2 rounded-xl text-left text-xs font-semibold transition ${
          collapsed ? "grid-cols-[2.25rem] justify-center px-0 py-1" : "grid-cols-[2.25rem_minmax(0,1fr)_0.75rem] px-2 py-1"
        } ${
          active ? "bg-white text-[#0759b8] shadow-lg shadow-blue-950/10" : "text-white/92 hover:bg-white/14 hover:text-white"
        }`}
      >
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
          active ? "bg-[#0759b8] text-white" : "bg-white/10 text-white group-hover:bg-white/18"
        }`}>
          <AppIcon name="gear" />
        </span>
        <span className={`truncate ${collapsed ? "hidden" : ""}`}>Tech Manual</span>
        {active && !collapsed ? <span className="h-2 w-2 rounded-full bg-[#0759b8]" /> : null}
      </button>
    </div>
  );
}

function SidebarLink({ item, active, collapsed }: { item: NavItem; active: boolean; collapsed: boolean }) {
  return (
    <Link
      href={item.href}
      title={item.label}
      className={`group grid items-center gap-2 rounded-xl text-xs font-semibold transition ${
        collapsed ? "grid-cols-[2.25rem] justify-center px-0 py-1" : "grid-cols-[2.25rem_minmax(0,1fr)_0.75rem] px-2 py-1"
      } ${
        active ? "bg-white text-[#0759b8] shadow-lg shadow-blue-950/10" : "text-white/92 hover:bg-white/14 hover:text-white"
      }`}
    >
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
          active ? "bg-[#0759b8] text-white" : "bg-white/10 text-white group-hover:bg-white/18"
        }`}
      >
        <AppIcon name={item.icon} />
      </span>
      <span className={`truncate ${collapsed ? "hidden" : ""}`}>{item.label}</span>
      {active && !collapsed ? <span className="h-2 w-2 rounded-full bg-[#0759b8]" /> : null}
    </Link>
  );
}

function MobileTechManualNav({ activePath, onOpen }: { activePath: string; onOpen: () => void }) {
  const active = isActivePath(activePath, "/tech-manual");

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`grid w-full grid-cols-[2.25rem_minmax(0,1fr)] items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold ${
          active ? "bg-white text-[#0759b8]" : "text-white/90 hover:bg-white/14"
        }`}
    >
      <span className="flex h-8 w-8 items-center justify-center">
        <AppIcon name="gear" />
      </span>
      <span>Tech Manual</span>
    </button>
  );
}

function TechManualPopup({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4" onClick={onClose}>
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-[0_28px_90px_rgba(15,23,42,0.24)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-blue-100 bg-gradient-to-br from-white via-blue-50/70 to-white px-5 py-5">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-200 bg-white text-blue-700 shadow-sm">
              <AppIcon name="gear" />
            </span>
            <span className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-500">Tech Manual</p>
              <h2 className="mt-1 text-xl font-semibold text-blue-950">Manual Library</h2>
              <p className="mt-1 text-xs font-medium leading-5 text-blue-600">Choose a category to open uploaded folders and documents.</p>
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-700 transition hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-200"
            aria-label="Close tech manual folders"
            title="Close"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="grid gap-3 bg-slate-50/70 p-5">
          {techManualItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className="group grid grid-cols-[3.25rem_minmax(0,1fr)_2rem] items-center gap-3 rounded-xl border border-blue-200 bg-white px-4 py-4 text-blue-950 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-[0_14px_34px_rgba(15,23,42,0.12)]"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-700 shadow-sm transition group-hover:bg-blue-100">
                <AppIcon name="folder" />
              </span>
              <span className="min-w-0">
                <span className="block font-semibold">{item.label}</span>
                <span className="mt-0.5 block truncate text-xs font-medium text-blue-600">{item.description}</span>
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-700 transition group-hover:bg-blue-700 group-hover:text-white">
                <ArrowRightIcon />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
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

function CloseIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 18 15 12 9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AppIcon({ name }: { name: IconName }) {
  const common = {
    className: "h-4 w-4",
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

  if (name === "gear") {
    return (
      <svg {...common}>
        <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .35 1.88l.04.04a2 2 0 0 1-2.83 2.83l-.04-.04A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6l-.02.03a2 2 0 0 1-3.96 0L10 20a1.7 1.7 0 0 0-1-.6 1.7 1.7 0 0 0-1.88.35l-.04.04a2 2 0 0 1-2.83-2.83l.04-.04A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1l-.03-.02a2 2 0 0 1 0-3.96L4 10a1.7 1.7 0 0 0 .6-1 1.7 1.7 0 0 0-.35-1.88l-.04-.04a2 2 0 1 1 2.83-2.83l.04.04A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6l.02-.03a2 2 0 0 1 3.96 0L14 4a1.7 1.7 0 0 0 1 .6 1.7 1.7 0 0 0 1.88-.35l.04-.04a2 2 0 0 1 2.83 2.83l-.04.04A1.7 1.7 0 0 0 19.4 9c.15.37.37.71.6 1l.03.02a2 2 0 0 1 0 3.96L20 14c-.23.29-.45.63-.6 1Z" />
      </svg>
    );
  }

  if (name === "folder") {
    return (
      <svg {...common}>
        <path d="M4 6.5h6l1.6 2H20v8.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6.5Z" />
        <path d="M4 9h16" />
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
