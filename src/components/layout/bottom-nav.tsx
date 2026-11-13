"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Receipt,
  Plus,
  PieChart,
  BarChart3,
  Menu,
  Wallet,
  Scale,
  Tags,
  Coins,
  Settings,
  X,
  LogOut,
  Search,
  BookOpen,
  RefreshCw,
  Target,
  History,
  CalendarClock,
  TrendingUp,
  Split,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { QuickAddSheet } from "@/components/layout/quick-add-sheet";
import { GlobalSearch } from "@/components/layout/global-search";
import { Account, Category, EnrichedTransaction, Debt } from "@/types/database";
import { logout } from "@/actions/auth";
import { useLanguage } from "@/lib/i18n/language-context";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { PrivacyToggle } from "@/components/layout/privacy-toggle";

interface BottomNavProps {
  accounts?: Account[];
  categories?: Category[];
  transactions?: EnrichedTransaction[];
  debts?: Debt[];
  mostUsedCategoryByAccount?: Record<string, string>;
}

export function BottomNav({
  accounts = [],
  categories = [],
  transactions = [],
  debts = [],
  mostUsedCategoryByAccount = {},
}: BottomNavProps) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Global keyboard shortcut listener for Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Mobile navigation items
  const mobileNavItems = [
    {
      label: t.nav.home,
      href: "/dashboard",
      icon: LayoutDashboard,
      isActive: pathname === "/dashboard",
    },
    {
      label: t.nav.transactions,
      href: "/transactions",
      icon: Receipt,
      isActive: pathname.startsWith("/transactions"),
    },
    {
      label: t.nav.quickLog,
      isAction: true,
      onClick: () => setIsQuickAddOpen(true),
      icon: Plus,
    },
    {
      label: t.nav.analytics,
      href: "/reports",
      icon: BarChart3,
      isActive: pathname.startsWith("/reports"),
    },
    {
      label: t.nav.more,
      isMore: true,
      onClick: () => setIsMoreMenuOpen(true),
      icon: Menu,
      isActive:
        pathname.startsWith("/budget") ||
        pathname.startsWith("/split-bill") ||
        pathname.startsWith("/goals") ||
        pathname.startsWith("/due-center") ||
        pathname.startsWith("/investments") ||
        pathname.startsWith("/recurring") ||
        pathname.startsWith("/accounts") ||
        pathname.startsWith("/debts") ||
        pathname.startsWith("/categories") ||
        pathname.startsWith("/net-worth") ||
        pathname.startsWith("/guide") ||
        pathname.startsWith("/settings"),
    },
  ];

  // Categorized desktop sidebar navigation groups
  const sidebarGroups = [
    {
      title: t.nav.mainMenu,
      items: [
        {
          label: t.nav.overview,
          href: "/dashboard",
          icon: LayoutDashboard,
          isActive: pathname === "/dashboard",
        },
        {
          label: t.nav.transactions,
          href: "/transactions",
          icon: Receipt,
          isActive: pathname.startsWith("/transactions"),
        },
        {
          label: t.nav.splitBill,
          href: "/split-bill",
          icon: Split,
          isActive: pathname.startsWith("/split-bill"),
        },
        {
          label: t.nav.reports,
          href: "/reports",
          icon: BarChart3,
          isActive: pathname.startsWith("/reports"),
        },
      ],
    },
    {
      title: t.nav.planningDues,
      items: [
        {
          label: t.nav.dueDatesBills,
          href: "/due-center",
          icon: CalendarClock,
          isActive: pathname.startsWith("/due-center"),
        },
        {
          label: t.nav.budget,
          href: "/budget",
          icon: PieChart,
          isActive: pathname.startsWith("/budget"),
        },
        {
          label: t.investments.title,
          href: "/investments",
          icon: TrendingUp,
          isActive: pathname.startsWith("/investments"),
        },
        {
          label: t.nav.goals,
          href: "/goals",
          icon: Target,
          isActive: pathname.startsWith("/goals"),
        },
        {
          label: t.nav.recurringShort,
          href: "/recurring",
          icon: RefreshCw,
          isActive: pathname.startsWith("/recurring"),
        },
        {
          label: t.debts.title,
          href: "/debts",
          icon: Scale,
          isActive: pathname.startsWith("/debts"),
        },
        {
          label: t.nav.netWorthShort,
          href: "/net-worth",
          icon: Coins,
          isActive: pathname.startsWith("/net-worth"),
        },
      ],
    },
    {
      title: t.nav.masterDataTools,
      items: [
        {
          label: t.accounts.title,
          href: "/accounts",
          icon: Wallet,
          isActive: pathname.startsWith("/accounts"),
        },
        {
          label: t.categories.title,
          href: "/categories",
          icon: Tags,
          isActive: pathname.startsWith("/categories"),
        },
        {
          label: t.nav.auditTrail,
          href: "/audit-log",
          icon: History,
          isActive: pathname.startsWith("/audit-log"),
        },
        {
          label: t.nav.guide,
          href: "/guide",
          icon: BookOpen,
          isActive: pathname.startsWith("/guide"),
        },
        {
          label: t.nav.settings,
          href: "/settings",
          icon: Settings,
          isActive: pathname.startsWith("/settings"),
        },
      ],
    },
  ];

  const moreLinks = [
    {
      label: t.nav.splitBill,
      href: "/split-bill",
      icon: Split,
      desc: t.nav.splitBillDesc,
    },
    {
      label: t.nav.dueDatesBills,
      href: "/due-center",
      icon: CalendarClock,
      desc: t.nav.dueDatesDesc,
    },
    {
      label: t.nav.budget,
      href: "/budget",
      icon: PieChart,
      desc: t.nav.budgetDesc,
    },
    {
      label: t.investments.title,
      href: "/investments",
      icon: TrendingUp,
      desc: t.nav.investmentsDesc,
    },
    { label: t.nav.goals, href: "/goals", icon: Target, desc: t.nav.goalsDesc },
    {
      label: t.nav.recurring,
      href: "/recurring",
      icon: RefreshCw,
      desc: t.nav.recurringDesc,
    },
    {
      label: t.nav.accounts,
      href: "/accounts",
      icon: Wallet,
      desc: t.nav.accountsDesc,
    },
    { label: t.nav.debts, href: "/debts", icon: Scale, desc: t.nav.debtsDesc },
    {
      label: t.nav.categories,
      href: "/categories",
      icon: Tags,
      desc: t.nav.categoriesDesc,
    },
    {
      label: t.nav.netWorth,
      href: "/net-worth",
      icon: Coins,
      desc: t.nav.netWorthDesc,
    },
    {
      label: t.nav.guide,
      href: "/guide",
      icon: BookOpen,
      desc: t.nav.guideDesc,
    },
    {
      label: t.nav.settings,
      href: "/settings",
      icon: Settings,
      desc: t.nav.settingsDesc,
    },
  ];

  return (
    <>
      {/* 1. Mobile Bottom Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-surface border-t border-border pb-safe md:hidden print:hidden">
        <div className="flex items-center justify-around h-14 px-1">
          {mobileNavItems.map((item, idx) => {
            if (item.isAction) {
              return (
                <button
                  key={idx}
                  onClick={item.onClick}
                  className="flex flex-col items-center justify-center -mt-5 bg-primary text-primary-foreground w-12 h-12 rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer"
                  aria-label={item.label}
                >
                  <item.icon className="w-5 h-5 stroke-[2.5]" />
                </button>
              );
            }

            if (item.isMore) {
              return (
                <button
                  key={idx}
                  onClick={item.onClick}
                  className={cn(
                    "flex flex-col items-center justify-center flex-1 py-1 text-[10px] font-semibold transition-colors cursor-pointer",
                    item.isActive
                      ? "text-foreground"
                      : "text-foreground-muted hover:text-foreground",
                  )}
                >
                  <item.icon className="w-4 h-4 mb-0.5" />
                  <span>{item.label}</span>
                </button>
              );
            }

            return (
              <Link
                key={idx}
                href={item.href!}
                className={cn(
                  "flex flex-col items-center justify-center flex-1 py-1 text-[10px] font-semibold transition-colors cursor-pointer",
                  item.isActive
                    ? "text-foreground"
                    : "text-foreground-muted hover:text-foreground",
                )}
              >
                <item.icon className="w-4 h-4 mb-0.5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* 2. Modern Desktop Fixed Sidebar */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 w-64 bg-surface border-r border-border z-40 select-none print:hidden">
        {/* Brand Header */}
        <div className="p-4 flex items-center justify-between border-b border-border">
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <Image
              src="/logo.png"
              alt="Pocketly"
              width={28}
              height={28}
              className="w-7 h-7 object-contain group-hover:scale-105 transition-transform"
              priority
            />
            <div className="flex flex-col">
              <span className="font-extrabold text-base tracking-tight text-foreground leading-tight">
                Pocketly
              </span>
              <span className="text-[10px] font-mono text-foreground-muted leading-none">
                Financial Tracker
              </span>
            </div>
          </Link>
        </div>

        {/* Quick Action & Global Search Buttons */}
        <div className="p-3 pb-2 flex flex-col gap-2">
          {/* Quick Add Button */}
          <button
            type="button"
            onClick={() => setIsQuickAddOpen(true)}
            className="w-full h-9 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>{t.nav.quickLog}</span>
          </button>

          {/* Global Search Trigger */}
          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            className="w-full h-8 px-3 rounded-lg text-xs text-foreground-secondary hover:text-foreground bg-surface-subtle hover:bg-muted border border-border transition-colors flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-foreground-muted" />
              <span className="font-medium">{t.common.search}</span>
            </div>
            <kbd className="text-[10px] font-mono px-1 py-0.2 rounded bg-surface text-foreground-secondary border border-border">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Scrollable Navigation Groups */}
        <div className="flex-1 px-3 py-2 overflow-y-auto no-scrollbar flex flex-col gap-4">
          {sidebarGroups.map((group, gIdx) => (
            <div key={gIdx} className="flex flex-col gap-1">
              <span className="px-2.5 text-[10px] font-bold uppercase tracking-wider text-foreground-muted">
                {group.title}
              </span>
              <div className="flex flex-col gap-0.5">
                {group.items.map((item, idx) => (
                  <Link
                    key={idx}
                    href={item.href}
                    className={cn(
                      "px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2.5 transition-all cursor-pointer",
                      item.isActive
                        ? "bg-primary text-primary-foreground shadow-2xs font-bold"
                        : "text-foreground-secondary hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer: Privacy, Theme & Logout */}
        <div className="p-3 border-t border-border flex flex-col gap-2 bg-surface-subtle/50">
          <div className="flex items-center justify-between gap-1">
            <PrivacyToggle />
            <ThemeToggle />
          </div>

          <form action={logout}>
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 py-1.5 rounded-lg bg-destructive-muted text-destructive font-bold text-xs hover:opacity-90 transition-colors border border-destructive/30 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{t.nav.signOut}</span>
            </button>
          </form>
        </div>
      </aside>

      {/* 3. More Slide-over Sheet (Mobile) */}
      {isMoreMenuOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center md:hidden">
          <div
            className="fixed inset-0 bg-overlay"
            onClick={() => setIsMoreMenuOpen(false)}
          />
          <div className="relative w-full bg-surface rounded-t-xl border-t border-border p-5 z-10 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm uppercase tracking-wider text-foreground">
                {t.nav.more}
              </h3>
              <button
                onClick={() => setIsMoreMenuOpen(false)}
                className="p-1 text-foreground-muted hover:text-foreground rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mobile Search button */}
            <button
              onClick={() => {
                setIsMoreMenuOpen(false);
                setIsSearchOpen(true);
              }}
              className="w-full flex items-center justify-between p-3 rounded-lg bg-surface-subtle hover:bg-muted transition-colors border border-border mb-3 text-left cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Search className="w-4 h-4 text-foreground-secondary" />
                <span className="text-xs font-bold text-foreground">
                  {t.nav.globalSearch}
                </span>
              </div>
              <span className="text-[10px] font-mono text-foreground-muted">
                Ctrl+K
              </span>
            </button>

            <div className="grid grid-cols-1 gap-2 mb-5">
              {moreLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsMoreMenuOpen(false)}
                  className="flex items-center gap-3 p-3 rounded-lg bg-surface-subtle hover:bg-muted transition-colors border border-border"
                >
                  <div className="w-8 h-8 rounded-md bg-surface text-foreground border border-border flex items-center justify-center shrink-0">
                    <link.icon className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="text-xs font-bold text-foreground truncate">
                      {link.label}
                    </div>
                    <div className="text-[11px] text-foreground-secondary truncate">
                      {link.desc}
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            <form action={logout}>
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-destructive-muted text-destructive font-bold text-xs hover:opacity-90 transition-colors border border-destructive/30 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                {t.nav.signOut}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 4. Global Search Modal */}
      <GlobalSearch
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        accounts={accounts}
        categories={categories}
        transactions={transactions}
        debts={debts}
      />

      {/* 5. Quick Add Bottom Sheet */}
      <QuickAddSheet
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        accounts={accounts}
        categories={categories}
        mostUsedCategoryByAccount={mostUsedCategoryByAccount}
      />
    </>
  );
}
