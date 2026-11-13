"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n/language-context";
import {
  BookOpen,
  ArrowLeft,
  Zap,
  Wallet,
  PieChart,
  Scale,
  Coins,
  Download,
  Search,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  BarChart3,
  History,
  Camera,
  CalendarClock,
  TrendingUp,
  Target,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

export default function GuidePage() {
  const { t } = useLanguage();
  const g = t.guide;
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    quickStart: true,
    ocrReceiptScanner: true,
    dueCenter: true,
    investments: true,
    savingsGoals: true,
    recurring: true,
    accounts: true,
    debts: true,
    budgets: true,
    netWorth: true,
    cashflowAnalytics: true,
    auditTrail: true,
    search: true,
    backup: true,
  });

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const sections = [
    {
      key: "quickStart",
      icon: Zap,
      data: g.sections.quickStart,
      badge: "Speed of Input",
      color: "text-success bg-success/10 border-success/20",
    },
    {
      key: "ocrReceiptScanner",
      icon: Camera,
      data: g.sections.ocrReceiptScanner,
      badge: "AI Smart OCR",
      color: "text-info bg-info/10 border-info/20",
    },
    {
      key: "dueCenter",
      icon: CalendarClock,
      data: g.sections.dueCenter,
      badge: "Obligation Hub",
      color: "text-warning bg-warning/10 border-warning/20",
    },
    {
      key: "investments",
      icon: TrendingUp,
      data: g.sections.investments,
      badge: "IDX Stock Portfolio",
      color: "text-success bg-success/10 border-success/20",
    },
    {
      key: "savingsGoals",
      icon: Target,
      data: g.sections.savingsGoals,
      badge: "Goal Milestone",
      color: "text-info bg-info/10 border-info/20",
    },
    {
      key: "recurring",
      icon: RefreshCw,
      data: g.sections.recurring,
      badge: "Subscriptions",
      color: "text-success bg-success/10 border-success/20",
    },
    {
      key: "accounts",
      icon: Wallet,
      data: g.sections.accounts,
      badge: "Multi-Currency",
      color: "text-info bg-info/10 border-info/20",
    },
    {
      key: "debts",
      icon: Scale,
      data: g.sections.debts,
      badge: "Payables & Receivables",
      color: "text-destructive bg-destructive/10 border-destructive/20",
    },
    {
      key: "budgets",
      icon: PieChart,
      data: g.sections.budgets,
      badge: "Multi-Currency Budget",
      color: "text-info bg-info/10 border-info/20",
    },
    {
      key: "netWorth",
      icon: Coins,
      data: g.sections.netWorth,
      badge: "Balance Sheet",
      color: "text-success bg-success/10 border-success/20",
    },
    {
      key: "cashflowAnalytics",
      icon: BarChart3,
      data: g.sections.cashflowAnalytics,
      badge: "Analytics",
      color: "text-success bg-success/10 border-success/20",
    },
    {
      key: "auditTrail",
      icon: History,
      data: g.sections.auditTrail,
      badge: g.auditTrailBadge,
      color: "text-info bg-info/10 border-info/20",
    },
    {
      key: "search",
      icon: Search,
      data: g.sections.search,
      badge: "⌘K / Ctrl+K",
      color:
        "text-foreground bg-surface-muted border-border",
    },
    {
      key: "backup",
      icon: Download,
      data: g.sections.backup,
      badge: "Privacy & Backup",
      color: "text-info bg-info/10 border-info/20",
    },
  ];

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      {/* Top Nav Back */}
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground-muted hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t.common.back}</span>
        </Link>
        <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded bg-surface-muted text-foreground-muted border border-border">
          {g.badge}
        </span>
      </div>

      {/* Hero Header */}
      <div className="p-5 sm:p-6 rounded-xl bg-surface border border-border flex flex-col gap-2.5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-surface-inverse text-foreground-inverse flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
              {g.title}
            </h1>
            <p className="text-xs text-foreground-muted mt-0.5">
              {g.subtitle}
            </p>
          </div>
        </div>
      </div>

      {/* Interactive Guide Sections List */}
      <div className="flex flex-col gap-3.5">
        {sections.map((sec) => {
          if (!sec.data) return null;
          const isOpen = !!openSections[sec.key];
          const IconComponent = sec.icon;

          return (
            <div
              key={sec.key}
              className="rounded-xl bg-surface border border-border overflow-hidden transition-all"
            >
              {/* Header Accordion Toggle */}
              <button
                type="button"
                onClick={() => toggleSection(sec.key)}
                className="w-full flex items-center justify-between p-4 sm:p-5 text-left hover:bg-surface-subtle/50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3.5 min-w-0 pr-2">
                  <div
                    className={cn(
                      "w-9 h-9 rounded-lg border flex items-center justify-center shrink-0",
                      sec.color,
                    )}
                  >
                    <IconComponent className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-xs sm:text-sm font-bold text-foreground truncate">
                        {sec.data.title}
                      </h2>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-surface-muted text-foreground-muted border border-border">
                        {sec.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-foreground-muted mt-0.5 leading-relaxed">
                      {sec.data.subtitle}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 text-foreground-muted">
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </div>
              </button>

              {/* Collapsible Content */}
              {isOpen && (
                <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-1 border-t border-border flex flex-col gap-3">
                  <p className="text-xs text-foreground-secondary leading-relaxed">
                    {sec.data.content}
                  </p>

                  {/* Step by step checklist */}
                  <div className="flex flex-col gap-2 p-3.5 rounded-lg bg-surface-subtle border border-border">
                    {sec.data.steps.map((step, sIdx) => (
                      <div
                        key={sIdx}
                        className="flex items-start gap-2 text-xs"
                      >
                        <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
                        <span className="text-foreground">
                          {step}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
