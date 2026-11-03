"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  BarChart3,
  Boxes,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  ReceiptText,
  Settings,
  ShoppingCart,
  Undo2,
  Users,
  X,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { cx } from "@/components/ui";
import { useStore } from "@/lib/store";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, admin: true },
  { href: "/pos", label: "New sale", icon: ShoppingCart },
  { href: "/sales", label: "Invoices", icon: ReceiptText },
  { href: "/returns", label: "Returns", icon: Undo2 },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/reports", label: "Reports", icon: BarChart3, admin: true },
  { href: "/activity", label: "Activity log", icon: History, admin: true },
  { href: "/settings", label: "Settings", icon: Settings, admin: true },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const store = useStore();
  const router = useRouter();
  const path = usePathname();
  const [open, setOpen] = useState(false);

  const current = NAV.find((n) => path.startsWith(n.href));
  const blocked = !!store?.user && !store.isAdmin && current?.admin;

  useEffect(() => {
    if (!store) return;
    if (!store.user) router.replace("/login");
    else if (blocked) router.replace("/pos");
  }, [store, blocked, router]);

  const products = store?.db.products;
  const lowStock = useMemo(() => products?.filter((p) => p.qty <= p.reorderLevel).length ?? 0, [products]);

  if (!store?.user || blocked) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted">Loading your shop…</div>;
  }
  const { user, isAdmin, db } = store;
  const nav = NAV.filter((n) => !n.admin || isAdmin);

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between px-5">
        <Logo light />
        <button className="rounded-lg p-1.5 text-case-ink/70 lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
          <X size={20} />
        </button>
      </div>
      <div className="well-dark mx-3 mb-3 rounded-xl px-3 py-2 text-xs text-case-ink/70">
        <div className="truncate font-medium text-case-ink">{db.settings.name}</div>
        <div className="truncate">ABN {db.settings.abn}</div>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={cx(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium",
                active ? "nav-key-on" : "nav-key",
              )}
            >
              <Icon size={18} />
              <span className="flex-1">{label}</span>
              {href === "/inventory" && lowStock > 0 && (
                <span className={cx("rounded-full px-1.5 text-xs", active ? "bg-white/20" : "bg-warn-soft text-warn")}>{lowStock}</span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <div className="keycap-brand flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold">
            {user.name
              .split(" ")
              .map((x) => x[0])
              .join("")}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-case-ink">{user.name}</div>
            <div className="text-xs text-case-ink/60">{user.role === "admin" ? "Owner · Admin" : "Staff"}</div>
          </div>
          <button
            onClick={() => {
              store.logout();
              router.replace("/login");
            }}
            className="rounded-lg p-2 text-case-ink/60 hover:bg-white/10 hover:text-case-ink"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-black/30 bg-case shadow-[inset_-1px_0_0_rgba(255,255,255,0.06),8px_0_24px_-18px_rgba(21,33,30,0.8)] lg:block">
        {sidebar}
      </aside>
      {open && (
        <div className="no-print fixed inset-0 z-40 bg-case/55 lg:hidden" onClick={() => setOpen(false)}>
          <aside className="h-full w-72 bg-case shadow-[12px_0_30px_-12px_rgba(0,0,0,0.45)]" onClick={(e) => e.stopPropagation()}>
            {sidebar}
          </aside>
        </div>
      )}
      <header className="no-print slab sticky top-0 z-20 flex h-14 items-center gap-3 rounded-none px-4 lg:hidden">
        <button onClick={() => setOpen(true)} className="rounded-lg p-1.5 text-ink" aria-label="Open menu">
          <Menu size={22} />
        </button>
        <Logo compact />
        <span className="font-medium">{current?.label}</span>
      </header>
      <main className="lg:pl-64">
        <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
