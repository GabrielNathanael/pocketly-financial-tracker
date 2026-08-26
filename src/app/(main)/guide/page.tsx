"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n/language-context";
import {
  BookOpen,
  ArrowLeft,
  Zap,
  Star,
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
  ListPlus,
  ShieldCheck,
  Filter,
  Camera,
  CalendarClock,
  TrendingUp,
  Target,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

export default function GuidePage() {
  const { t, language } = useLanguage();
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
      color: "text-[#0D9488] bg-[#0D9488]/10 border-[#0D9488]/20",
    },
    {
      key: "ocrReceiptScanner",
      icon: Camera,
      data: g.sections.ocrReceiptScanner,
      badge: "AI Smart OCR",
      color: "text-[#0284C7] bg-[#0284C7]/10 border-[#0284C7]/20",
    },
    {
      key: "dueCenter",
      icon: CalendarClock,
      data: g.sections.dueCenter,
      badge: "Obligation Hub",
      color: "text-[#F59E0B] bg-[#F59E0B]/10 border-[#F59E0B]/20",
    },
    {
      key: "investments",
      icon: TrendingUp,
      data: g.sections.investments,
      badge: "IDX Stock Portfolio",
      color: "text-[#10B981] bg-[#10B981]/10 border-[#10B981]/20",
    },
    {
      key: "savingsGoals",
      icon: Target,
      data: g.sections.savingsGoals,
      badge: "Goal Milestone",
      color: "text-[#8B5CF6] bg-[#8B5CF6]/10 border-[#8B5CF6]/20",
    },
    {
      key: "recurring",
      icon: RefreshCw,
      data: g.sections.recurring,
      badge: "Subscriptions",
      color: "text-[#0D9488] bg-[#0D9488]/10 border-[#0D9488]/20",
    },
    {
      key: "accounts",
      icon: Wallet,
      data: g.sections.accounts,
      badge: "Multi-Currency",
      color: "text-[#0284C7] bg-[#0284C7]/10 border-[#0284C7]/20",
    },
    {
      key: "debts",
      icon: Scale,
      data: g.sections.debts,
      badge: "Payables & Receivables",
      color: "text-[#E11D48] bg-[#E11D48]/10 border-[#E11D48]/20",
    },
    {
      key: "budgets",
      icon: PieChart,
      data: g.sections.budgets,
      badge: "Multi-Currency Budget",
      color: "text-[#8B5CF6] bg-[#8B5CF6]/10 border-[#8B5CF6]/20",
    },
    {
      key: "netWorth",
      icon: Coins,
      data: g.sections.netWorth,
      badge: "Balance Sheet",
      color: "text-[#10B981] bg-[#10B981]/10 border-[#10B981]/20",
    },
    {
      key: "cashflowAnalytics",
      icon: BarChart3,
      data: g.sections.cashflowAnalytics,
      badge: "Analytics",
      color: "text-[#10B981] bg-[#10B981]/10 border-[#10B981]/20",
    },
    {
      key: "auditTrail",
      icon: History,
      data: g.sections.auditTrail,
      badge: language === 'en' ? "Activity History" : "Riwayat Perubahan",
      color: "text-[#6366F1] bg-[#6366F1]/10 border-[#6366F1]/20",
    },
    {
      key: "search",
      icon: Search,
      data: g.sections.search,
      badge: "⌘K / Ctrl+K",
      color:
        "text-[#0F172A] dark:text-[#FAFAFA] bg-[#F1F3F5] dark:bg-[#1A1A20] border-[#E5E7EB] dark:border-[#27272A]",
    },
    {
      key: "backup",
      icon: Download,
      data: g.sections.backup,
      badge: "Privacy & Backup",
      color: "text-[#475569] bg-[#475569]/10 border-[#475569]/20",
    },
  ];

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      {/* Top Nav Back */}
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#FAFAFA] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t.common.back}</span>
        </Link>
        <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded bg-[#F1F3F5] dark:bg-[#1A1A20] text-[#64748B] dark:text-[#94A3B8] border border-[#E5E7EB] dark:border-[#27272A]">
          {g.badge}
        </span>
      </div>

      {/* Hero Header */}
      <div className="p-5 sm:p-6 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-2.5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#0F172A] dark:bg-[#FAFAFA] text-white dark:text-[#0F172A] flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[#0F172A] dark:text-[#F8FAFC]">
              {g.title}
            </h1>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-0.5">
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
              className="rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] overflow-hidden transition-all"
            >
              {/* Header Accordion Toggle */}
              <button
                type="button"
                onClick={() => toggleSection(sec.key)}
                className="w-full flex items-center justify-between p-4 sm:p-5 text-left hover:bg-[#F8F9FA] dark:hover:bg-[#1A1A20]/50 transition-colors cursor-pointer"
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
                      <h2 className="text-xs sm:text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC] truncate">
                        {sec.data.title}
                      </h2>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#F1F3F5] dark:bg-[#1A1A20] text-[#64748B] dark:text-[#94A3B8] border border-[#E5E7EB] dark:border-[#27272A]">
                        {sec.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-0.5 leading-relaxed">
                      {sec.data.subtitle}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 text-[#94A3B8]">
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </div>
              </button>

              {/* Collapsible Content */}
              {isOpen && (
                <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-1 border-t border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-3">
                  <p className="text-xs text-[#334155] dark:text-[#CBD5E1] leading-relaxed">
                    {sec.data.content}
                  </p>

                  {/* Step by step checklist */}
                  <div className="flex flex-col gap-2 p-3.5 rounded-lg bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A]">
                    {sec.data.steps.map((step, sIdx) => (
                      <div
                        key={sIdx}
                        className="flex items-start gap-2 text-xs"
                      >
                        <CheckCircle2 className="w-4 h-4 text-[#0D9488] shrink-0 mt-0.5" />
                        <span className="text-[#0F172A] dark:text-[#F8FAFC]">
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
