"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  LayoutDashboard, User, Building2, FileText, History, Mic, Settings,
  Menu, X, CloudCheck, CircleAlert, ChevronsUpDown, Puzzle, Plus,
} from "lucide-react";
import { DBadge } from "@/components/brand/DBadge";
import { cacheGet } from "@/lib/client/local-cache";

export interface ShellUser { id: string; name: string; email: string | null }

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/vault/personal", label: "My Vault", icon: User, matchPrefix: "/vault/personal" },
  { href: "/vault/business", label: "Business Vault", icon: Building2, matchPrefix: "/vault/business" },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/applications", label: "Applications", icon: History },
  { href: "/assistant", label: "D Assistant", icon: Mic },
  { href: "/settings", label: "Settings", icon: Settings },
];

const MOBILE_NAV = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/vault/personal", label: "Vault", icon: User },
  { href: "/assistant", label: "D", icon: Mic },
  { href: "/applications", label: "Apps", icon: History },
  { href: "/documents", label: "Docs", icon: FileText },
];

export function AppShell({ user, children }: { user: ShellUser; children: ReactNode }) {
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);
  const [menu, setMenu] = useState(false);
  const [cachedCount, setCachedCount] = useState<number | null>(null);

  useEffect(() => {
    // local-cache health for the sync pill
    cacheGet(`fields:${user.id}`).then((v) => {
      setCachedCount(Array.isArray(v) ? (v as unknown[]).length : 0);
    }).catch(() => setCachedCount(null));
  }, [user.id]);

  const initials = (user.name || "D")
    .split(/[\s@.]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  return (
    <div className="flex min-h-screen bg-mist-50">
      {/* ================= Desktop sidebar ================= */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col bg-ink-900 lg:flex">
        <div className="flex h-16 items-center px-5">
          <Link href="/dashboard" aria-label="Dashboard">
            <span className="flex items-center gap-2.5">
              <DBadge size={32} />
              <span className="font-display text-[15px] font-extrabold tracking-tight text-white">D-VAULT</span>
            </span>
          </Link>
        </div>

        <nav className="mt-4 flex-1 space-y-0.5 px-3" aria-label="Main">
          {NAV.map((item) => {
            const active = pathname === item.href || (item.matchPrefix && pathname.startsWith(item.matchPrefix)) ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-all",
                  active
                    ? "bg-electric-600/15 text-white"
                    : "text-slate-400 hover:bg-white/5 hover:text-ice-200",
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-bright-500" aria-hidden />
                )}
                <item.icon className={clsx("h-[18px] w-[18px]", active ? "text-ice-300" : "text-slate-500 group-hover:text-ice-300")} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* extension CTA */}
        <div className="px-3">
          <Link
            href="/extension-setup"
            className="flex items-center gap-3 rounded-xl border border-electric-600/30 bg-electric-600/10 px-3.5 py-3 text-[12.5px] font-semibold text-ice-300 transition hover:border-bright-500/50"
          >
            <Puzzle className="h-4 w-4" />
            Install Chrome extension
          </Link>
        </div>

        {/* sync status */}
        <div className="mx-3 mt-4 rounded-xl border border-white/8 bg-white/[0.03] px-3.5 py-3">
          <div className="flex items-center gap-2 text-[11.5px] font-semibold text-slate-400">
            {cachedCount !== null ? (
              <>
                <CloudCheck className="h-3.5 w-3.5 text-emerald-400" />
                Synced · {cachedCount} fields cached locally
              </>
            ) : (
              <>
                <CircleAlert className="h-3.5 w-3.5 text-amber-400" />
                Local cache empty
              </>
            )}
          </div>
        </div>

        {/* user profile + account menu */}
        <div className="relative mt-3 px-3 pb-4">
          <button
            onClick={() => setMenu((m) => !m)}
            aria-expanded={menu}
            aria-haspopup="menu"
            className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-white/5"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-electric-600 to-ink-700 text-[12px] font-bold text-white">
              {initials || "D"}
            </span>
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-[13px] font-semibold text-white">{user.name || "Local user"}</span>
              <span className="block truncate text-[11px] text-slate-500">
                {user.email || "Local vault · no account"}
              </span>
            </span>
            <ChevronsUpDown className="h-3.5 w-3.5 text-slate-500" />
          </button>

          {menu && (
            <div role="menu" className="absolute bottom-full left-3 right-3 mb-2 overflow-hidden rounded-xl border border-white/10 bg-ink-800 py-1 shadow-lift">
              <Link href="/profiles" role="menuitem" className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-slate-300 hover:bg-white/5">
                <Plus className="h-3.5 w-3.5" /> Manage profiles
              </Link>
              <Link href="/settings" role="menuitem" className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-slate-300 hover:bg-white/5">
                <Settings className="h-3.5 w-3.5" /> Settings
              </Link>
            </div>
          )}
        </div>
      </aside>

      {/* ================= Mobile drawer ================= */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button aria-label="Close menu" className="absolute inset-0 bg-ink-950/60" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[280px] flex-col bg-ink-900 fade-in">
            <div className="flex h-16 items-center justify-between px-5">
              <span className="flex items-center gap-2.5">
                <DBadge size={30} />
                <span className="font-display text-[15px] font-extrabold text-white">D-VAULT</span>
              </span>
              <button onClick={() => setDrawer(false)} aria-label="Close menu" className="p-1 text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
              {NAV.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setDrawer(false)}
                    className={clsx(
                      "flex items-center gap-3 rounded-xl px-3 py-3 text-[14px] font-medium",
                      active ? "bg-electric-600/15 text-white" : "text-slate-400 hover:bg-white/5",
                    )}
                  >
                    <item.icon className="h-[18px] w-[18px]" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      {/* ================= Main column ================= */}
      <div className="flex min-h-screen w-full flex-col lg:pl-[248px]">
        {/* mobile topbar */}
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-mist-200 bg-white/85 px-4 backdrop-blur-md lg:hidden">
          <button onClick={() => setDrawer(true)} aria-label="Open menu" className="rounded-lg p-1.5 text-ink-700 hover:bg-mist-100">
            <Menu className="h-5.5 w-5.5" />
          </button>
          <span className="flex items-center gap-2">
            <DBadge size={26} />
            <span className="font-display text-[14px] font-extrabold text-ink-900">D-VAULT</span>
          </span>
          <Link href="/assistant" aria-label="D assistant" className="rounded-full bg-electric-600/10 p-2 text-electric-600">
            <Mic className="h-4 w-4" />
          </Link>
        </header>

        <main className="flex-1 pb-20 lg:pb-0">{children}</main>
      </div>

      {/* ================= Mobile bottom nav ================= */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch justify-around border-t border-mist-200 bg-white/95 backdrop-blur-md lg:hidden" aria-label="Primary">
        {MOBILE_NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/") ||
            (item.label === "Vault" && pathname.startsWith("/vault"));
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={clsx(
                "relative flex flex-col items-center justify-center gap-1 px-3 text-[10.5px] font-semibold",
                active ? "text-electric-600" : "text-slate-400",
              )}
            >
              {active && <span className="absolute top-0 h-[3px] w-8 rounded-full bg-electric-600" aria-hidden />}
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
