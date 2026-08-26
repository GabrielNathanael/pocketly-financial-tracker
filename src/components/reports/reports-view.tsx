"use client";

import React, { useState, useMemo } from "react";
import { EnrichedTransaction, Account, Category } from "@/types/database";
import {
  formatCurrency,
  convertAmount,
  ForexRatesMap,
} from "@/lib/utils/currency";
import { usePreferredCurrency } from "@/lib/storage/preferred-currency";
import { usePrivacyMode, maskCurrency } from "@/lib/storage/privacy-mode";
import { useLanguage } from "@/lib/i18n/language-context";
import { getCleanDescription } from "@/lib/utils/description";
import { DynamicIcon } from "@/components/ui/dynamic-icon";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils/cn";
import {
  startOfMonth,
  endOfMonth,
  subMonths,
  startOfYear,
  endOfYear,
  isWithinInterval,
  parseISO,
  format,
  differenceInCalendarDays,
  eachDayOfInterval,
  eachMonthOfInterval,
} from "date-fns";
import { id as idLocale, enUS } from "date-fns/locale";
import {
  Printer,
  TrendingUp,
  TrendingDown,
  Percent,
  Flame,
  Wallet,
  Calendar,
  Sparkles,
  AlertTriangle,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  PieChart as PieChartIcon,
  Scale,
  Hash,
  X,
} from "lucide-react";

interface ReportsViewProps {
  transactions: EnrichedTransaction[];
  accounts: Account[];
  categories: Category[];
  rates?: ForexRatesMap;
}

type PeriodType = "this_month" | "last_month" | "this_year" | "custom";

// Palette for Category Donut Chart
const DONUT_COLORS = [
  "#0F172A",
  "#0D9488",
  "#E11D48",
  "#F59E0B",
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
  "#10B981",
  "#6366F1",
  "#64748B",
];

export function ReportsView({
  transactions,
  accounts,
  categories,
  rates,
}: ReportsViewProps) {
  const { t, language } = useLanguage();
  const displayCurrency = usePreferredCurrency();
  const isPrivate = usePrivacyMode();
  const dateFnsLocale = language === "id" ? idLocale : enUS;

  const [period, setPeriod] = useState<PeriodType>("this_month");
  const [selectedTag, setSelectedTag] = useState<string>("all");
  const [categoryTab, setCategoryTab] = useState<"expense" | "income">(
    "expense",
  );
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<
    string | null
  >(null);
  const [customRange, setCustomRange] = useState<{
    start: string;
    end: string;
  }>({
    start: format(startOfMonth(new Date()), "yyyy-MM-dd"),
    end: format(endOfMonth(new Date()), "yyyy-MM-dd"),
  });

  // Extract unique available tags across transactions
  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    transactions.forEach((tx) => {
      if (tx.tags && Array.isArray(tx.tags)) {
        tx.tags.forEach((t) => tagSet.add(t));
      }
    });
    return Array.from(tagSet).sort();
  }, [transactions]);

  const now = new Date();

  // Calculate Active Interval Date Range
  const { intervalStart, intervalEnd, priorIntervalStart, priorIntervalEnd } =
    useMemo(() => {
      let start = startOfMonth(now);
      let end = endOfMonth(now);
      let pStart = startOfMonth(subMonths(now, 1));
      let pEnd = endOfMonth(subMonths(now, 1));

      if (period === "last_month") {
        start = startOfMonth(subMonths(now, 1));
        end = endOfMonth(subMonths(now, 1));
        pStart = startOfMonth(subMonths(now, 2));
        pEnd = endOfMonth(subMonths(now, 2));
      } else if (period === "this_year") {
        start = startOfYear(now);
        end = endOfYear(now);
        pStart = startOfYear(subMonths(now, 12));
        pEnd = endOfYear(subMonths(now, 12));
      } else if (period === "custom") {
        start = customRange.start
          ? parseISO(customRange.start)
          : startOfMonth(now);
        end = customRange.end ? parseISO(customRange.end) : endOfMonth(now);
        const dayDiff = Math.max(1, differenceInCalendarDays(end, start));
        pEnd = new Date(start.getTime() - 86400000);
        pStart = new Date(pEnd.getTime() - dayDiff * 86400000);
      }

      return {
        intervalStart: start,
        intervalEnd: end,
        priorIntervalStart: pStart,
        priorIntervalEnd: pEnd,
      };
    }, [period, customRange]);

  // Filter current & prior period transactions (with tag support)
  const currentPeriodTx = useMemo(() => {
    return transactions.filter((tx) => {
      try {
        const txDate = parseISO(tx.transaction_date);
        const inInterval = isWithinInterval(txDate, {
          start: intervalStart,
          end: intervalEnd,
        });
        if (!inInterval) return false;
        if (selectedTag !== "all") {
          const hasTag = tx.tags?.includes(selectedTag);
          if (!hasTag) return false;
        }
        return true;
      } catch {
        return false;
      }
    });
  }, [transactions, intervalStart, intervalEnd, selectedTag]);

  const priorPeriodTx = useMemo(() => {
    return transactions.filter((tx) => {
      try {
        const txDate = parseISO(tx.transaction_date);
        const inInterval = isWithinInterval(txDate, {
          start: priorIntervalStart,
          end: priorIntervalEnd,
        });
        if (!inInterval) return false;
        if (selectedTag !== "all") {
          const hasTag = tx.tags?.includes(selectedTag);
          if (!hasTag) return false;
        }
        return true;
      } catch {
        return false;
      }
    });
  }, [transactions, priorIntervalStart, priorIntervalEnd, selectedTag]);

  // Dynamic Readable Period Labels for clean comparison (e.g., "Agu 2026" vs "Jul 2026" or "2026" vs "2025")
  const { currentPeriodLabel, priorPeriodLabel } = useMemo(() => {
    if (period === "this_year") {
      return {
        currentPeriodLabel: format(intervalStart, "yyyy"),
        priorPeriodLabel: format(priorIntervalStart, "yyyy"),
      };
    }
    if (period === "this_month" || period === "last_month") {
      return {
        currentPeriodLabel: format(intervalStart, "MMM yyyy", {
          locale: dateFnsLocale,
        }),
        priorPeriodLabel: format(priorIntervalStart, "MMM yyyy", {
          locale: dateFnsLocale,
        }),
      };
    }
    return {
      currentPeriodLabel: `${format(intervalStart, "d MMM", { locale: dateFnsLocale })} - ${format(intervalEnd, "d MMM", { locale: dateFnsLocale })}`,
      priorPeriodLabel: `${format(priorIntervalStart, "d MMM", { locale: dateFnsLocale })} - ${format(priorIntervalEnd, "d MMM", { locale: dateFnsLocale })}`,
    };
  }, [
    period,
    intervalStart,
    intervalEnd,
    priorIntervalStart,
    priorIntervalEnd,
    dateFnsLocale,
  ]);

  // Aggregate Current Period Totals Normalized to Display Currency
  const {
    totalIncome,
    totalExpense,
    netSavings,
    savingsRate,
    dailyBurnRate,
    elapsedDays,
  } = useMemo(() => {
    let inc = 0;
    let exp = 0;

    currentPeriodTx.forEach((tx) => {
      const converted = convertAmount(
        tx.amount,
        tx.currency || tx.account?.currency || "IDR",
        displayCurrency,
        rates,
      );
      if (tx.type === "income") {
        inc += converted;
      } else {
        exp += converted;
      }
    });

    const net = inc - exp;
    const sRate = inc > 0 ? ((inc - exp) / inc) * 100 : exp > 0 ? -100 : 0;
    const days = Math.max(
      1,
      differenceInCalendarDays(intervalEnd, intervalStart) + 1,
    );
    const burnRate = exp / days;

    return {
      totalIncome: inc,
      totalExpense: exp,
      netSavings: net,
      savingsRate: sRate,
      dailyBurnRate: burnRate,
      elapsedDays: days,
    };
  }, [currentPeriodTx, displayCurrency, rates, intervalStart, intervalEnd]);

  // Aggregate Prior Period Totals for Side-by-Side Comparison
  const {
    priorTotalIncome,
    priorTotalExpense,
    priorNetSavings,
    priorSavingsRate,
  } = useMemo(() => {
    let inc = 0;
    let exp = 0;

    priorPeriodTx.forEach((tx) => {
      const converted = convertAmount(
        tx.amount,
        tx.currency || tx.account?.currency || "IDR",
        displayCurrency,
        rates,
      );
      if (tx.type === "income") {
        inc += converted;
      } else {
        exp += converted;
      }
    });

    const net = inc - exp;
    const sRate = inc > 0 ? ((inc - exp) / inc) * 100 : exp > 0 ? -100 : 0;

    return {
      priorTotalIncome: inc,
      priorTotalExpense: exp,
      priorNetSavings: net,
      priorSavingsRate: sRate,
    };
  }, [priorPeriodTx, displayCurrency, rates]);

  const expenseGrowthPct = useMemo(() => {
    if (priorTotalExpense === 0) return totalExpense > 0 ? 100 : 0;
    return ((totalExpense - priorTotalExpense) / priorTotalExpense) * 100;
  }, [totalExpense, priorTotalExpense]);

  const incomeGrowthPct = useMemo(() => {
    if (priorTotalIncome === 0) return totalIncome > 0 ? 100 : 0;
    return ((totalIncome - priorTotalIncome) / priorTotalIncome) * 100;
  }, [totalIncome, priorTotalIncome]);

  // Expense Categories Breakdown (Always full for print & screen)
  const allExpenseCategories = useMemo(() => {
    const map = new Map<
      string,
      { id: string; category: Category | null; total: number; count: number }
    >();
    currentPeriodTx.forEach((tx) => {
      if (tx.type === "expense") {
        const catId = tx.category_id || "uncategorized";
        const existing = map.get(catId) || {
          id: catId,
          category: tx.category || null,
          total: 0,
          count: 0,
        };
        const val = convertAmount(
          tx.amount,
          tx.currency || tx.account?.currency || "IDR",
          displayCurrency,
          rates,
        );
        existing.total += val;
        existing.count += 1;
        map.set(catId, existing);
      }
    });

    const list = Array.from(map.values()).sort((a, b) => b.total - a.total);
    return list.map((item, index) => ({
      ...item,
      color: DONUT_COLORS[index % DONUT_COLORS.length],
      percentage: totalExpense > 0 ? (item.total / totalExpense) * 100 : 0,
    }));
  }, [currentPeriodTx, totalExpense, displayCurrency, rates]);

  // Income Categories Breakdown (Always full for print & screen)
  const allIncomeCategories = useMemo(() => {
    const map = new Map<
      string,
      { id: string; category: Category | null; total: number; count: number }
    >();
    currentPeriodTx.forEach((tx) => {
      if (tx.type === "income") {
        const catId = tx.category_id || "uncategorized";
        const existing = map.get(catId) || {
          id: catId,
          category: tx.category || null,
          total: 0,
          count: 0,
        };
        const val = convertAmount(
          tx.amount,
          tx.currency || tx.account?.currency || "IDR",
          displayCurrency,
          rates,
        );
        existing.total += val;
        existing.count += 1;
        map.set(catId, existing);
      }
    });

    const list = Array.from(map.values()).sort((a, b) => b.total - a.total);
    return list.map((item, index) => ({
      ...item,
      color: DONUT_COLORS[index % DONUT_COLORS.length],
      percentage: totalIncome > 0 ? (item.total / totalIncome) * 100 : 0,
    }));
  }, [currentPeriodTx, totalIncome, displayCurrency, rates]);

  // Active Category Breakdown for interactive Donut / List
  const categoryBreakdown = useMemo(() => {
    return categoryTab === "expense"
      ? allExpenseCategories
      : allIncomeCategories;
  }, [categoryTab, allExpenseCategories, allIncomeCategories]);

  // Account Breakdown Aggregation
  const accountBreakdown = useMemo(() => {
    const map = new Map<
      string,
      { account: Account | null; total: number; count: number }
    >();

    currentPeriodTx.forEach((tx) => {
      if (tx.type === "expense") {
        const accId = tx.account_id || "unknown";
        const existing = map.get(accId) || {
          account: tx.account || null,
          total: 0,
          count: 0,
        };
        const val = convertAmount(
          tx.amount,
          tx.currency || tx.account?.currency || "IDR",
          displayCurrency,
          rates,
        );
        existing.total += val;
        existing.count += 1;
        map.set(accId, existing);
      }
    });

    const list = Array.from(map.values()).sort((a, b) => b.total - a.total);
    return list.map((item) => ({
      ...item,
      percentage: totalExpense > 0 ? (item.total / totalExpense) * 100 : 0,
    }));
  }, [currentPeriodTx, totalExpense, displayCurrency, rates]);

  // Filtered Transactions (By Selected Category from Donut)
  const displayedCategoryTransactions = useMemo(() => {
    if (!selectedCategoryFilter) return [];
    return currentPeriodTx
      .filter(
        (tx) =>
          (tx.category_id || "uncategorized") === selectedCategoryFilter &&
          tx.type === categoryTab,
      )
      .map((tx) => ({
        ...tx,
        convertedAmount: convertAmount(
          tx.amount,
          tx.currency || tx.account?.currency || "IDR",
          displayCurrency,
          rates,
        ),
      }))
      .sort((a, b) => b.convertedAmount - a.convertedAmount);
  }, [
    currentPeriodTx,
    selectedCategoryFilter,
    categoryTab,
    displayCurrency,
    rates,
  ]);

  // Top 5 / Top 10 Expenses
  const topExpenses = useMemo(() => {
    return [...currentPeriodTx]
      .filter((tx) => tx.type === "expense")
      .map((tx) => ({
        ...tx,
        convertedAmount: convertAmount(
          tx.amount,
          tx.currency || tx.account?.currency || "IDR",
          displayCurrency,
          rates,
        ),
      }))
      .sort((a, b) => b.convertedAmount - a.convertedAmount)
      .slice(0, 10);
  }, [currentPeriodTx, displayCurrency, rates]);

  // Timeline Trajectory
  const timelineData = useMemo(() => {
    if (period === "this_year") {
      const months = eachMonthOfInterval({
        start: intervalStart,
        end: intervalEnd,
      });
      return months.map((m) => {
        const mStart = startOfMonth(m);
        const mEnd = endOfMonth(m);
        let inc = 0;
        let exp = 0;

        currentPeriodTx.forEach((tx) => {
          const tDate = parseISO(tx.transaction_date);
          if (isWithinInterval(tDate, { start: mStart, end: mEnd })) {
            const val = convertAmount(
              tx.amount,
              tx.currency || tx.account?.currency || "IDR",
              displayCurrency,
              rates,
            );
            if (tx.type === "income") inc += val;
            else exp += val;
          }
        });

        return {
          label: format(m, "MMM", { locale: dateFnsLocale }),
          income: inc,
          expense: exp,
        };
      });
    } else {
      const allDays = eachDayOfInterval({
        start: intervalStart,
        end: intervalEnd,
      });
      const step = Math.max(1, Math.ceil(allDays.length / 14));
      const chunks: { label: string; income: number; expense: number }[] = [];

      for (let i = 0; i < allDays.length; i += step) {
        const chunkDays = allDays.slice(i, i + step);
        const cStart = chunkDays[0];
        const cEnd = chunkDays[chunkDays.length - 1];
        let inc = 0;
        let exp = 0;

        currentPeriodTx.forEach((tx) => {
          const tDate = parseISO(tx.transaction_date);
          if (isWithinInterval(tDate, { start: cStart, end: cEnd })) {
            const val = convertAmount(
              tx.amount,
              tx.currency || tx.account?.currency || "IDR",
              displayCurrency,
              rates,
            );
            if (tx.type === "income") inc += val;
            else exp += val;
          }
        });

        chunks.push({
          label:
            chunkDays.length > 1
              ? `${format(cStart, "d")}-${format(cEnd, "d MMM", { locale: dateFnsLocale })}`
              : format(cStart, "d MMM", { locale: dateFnsLocale }),
          income: inc,
          expense: exp,
        });
      }

      return chunks;
    }
  }, [
    period,
    intervalStart,
    intervalEnd,
    currentPeriodTx,
    displayCurrency,
    rates,
    dateFnsLocale,
  ]);

  const maxTimelineVal = useMemo(() => {
    let max = 0;
    timelineData.forEach((d) => {
      if (d.income > max) max = d.income;
      if (d.expense > max) max = d.expense;
    });
    return max || 1;
  }, [timelineData]);

  // Donut SVG Calculations with sleek thin ring (outerR=104, innerR=82) in 240x240 box
  const donutSlices = useMemo(() => {
    let cumulative = 0;
    const center = 120;
    const outerR = 104;
    const innerR = 82;

    return categoryBreakdown.map((cat) => {
      const startAngle = (cumulative / 100) * 360;
      cumulative += cat.percentage;
      const endAngle = (cumulative / 100) * 360;

      const startRad = ((startAngle - 90) * Math.PI) / 180;
      const endRad = ((endAngle - 90) * Math.PI) / 180;

      const x1 = center + outerR * Math.cos(startRad);
      const y1 = center + outerR * Math.sin(startRad);
      const x2 = center + outerR * Math.cos(endRad);
      const y2 = center + outerR * Math.sin(endRad);

      const ix1 = center + innerR * Math.cos(startRad);
      const iy1 = center + innerR * Math.sin(startRad);
      const ix2 = center + innerR * Math.cos(endRad);
      const iy2 = center + innerR * Math.sin(endRad);

      const largeArc = endAngle - startAngle > 180 ? 1 : 0;

      const pathData = `M ${x1} ${y1} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix1} ${iy1} Z`;

      return {
        ...cat,
        pathData,
      };
    });
  }, [categoryBreakdown]);

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      "Date",
      "Type",
      "Category",
      "Account",
      "Amount",
      "Currency",
      "Normalized Amount",
      "Display Currency",
      "Tags",
      "Description",
    ];
    const rows = currentPeriodTx.map((tx) => [
      format(parseISO(tx.transaction_date), "yyyy-MM-dd HH:mm"),
      tx.type,
      tx.category?.name || "Uncategorized",
      tx.account?.name || "Unknown",
      tx.amount,
      tx.currency || tx.account?.currency || "IDR",
      convertAmount(
        tx.amount,
        tx.currency || tx.account?.currency || "IDR",
        displayCurrency,
        rates,
      ),
      displayCurrency,
      `"${(tx.tags || []).join("; ")}"`,
      `"${(getCleanDescription(tx.description) || tx.category?.name || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((r) => r.join(",")),
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `Pocketly-Report-${format(intervalStart, "yyyyMMdd")}-${format(intervalEnd, "yyyyMMdd")}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle Clean Print PDF Trigger
  const handlePrint = () => {
    const originalTitle = document.title;
    document.title = `Pocketly-Financial-Report-${format(intervalStart, "MMM-yyyy", { locale: dateFnsLocale })}`;
    window.print();
    document.title = originalTitle;
  };

  // Dynamic Auto-scale helper
  const getCardFont = (strLen: number) => {
    if (strLen > 18) return "text-xs sm:text-sm";
    if (strLen > 13) return "text-sm sm:text-base";
    return "text-base sm:text-lg";
  };

  return (
    <div>
      {/* ========================================================================= */}
      {/* 1. SCREEN VIEW (Interactive App UI)                                       */}
      {/* ========================================================================= */}
      <div className="screen-only flex flex-col gap-6">
        {/* Header with Title & Action Buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#0F172A] dark:text-[#F8FAFC]">
              {t.reports.title}
            </h1>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8] font-mono leading-relaxed mt-0.5">
              {t.reports.subtitle}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
            <Button
              onClick={handleExportCSV}
              variant="outline"
              size="sm"
              className="gap-1.5 cursor-pointer text-xs font-semibold"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </Button>

            <Button
              onClick={handlePrint}
              size="sm"
              className="gap-1.5 cursor-pointer text-xs font-bold bg-[#0F172A] dark:bg-[#FAFAFA] text-white dark:text-[#0F172A]"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{t.reports.printBtn}</span>
            </Button>
          </div>
        </div>

        {/* Period Selector & Tag Filter Row */}
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
            {/* Period Segmented Controls */}
            <div className="grid grid-cols-2 sm:grid-cols-4 p-1 bg-[#F1F3F5] dark:bg-[#1A1A20] rounded-xl border border-[#E5E7EB] dark:border-[#27272A] gap-1 flex-1">
              <button
                type="button"
                onClick={() => {
                  setPeriod("this_month");
                  setSelectedCategoryFilter(null);
                }}
                className={cn(
                  "py-2 px-3 rounded-lg text-xs font-bold transition-all text-center cursor-pointer",
                  period === "this_month"
                    ? "bg-white dark:bg-[#121215] text-[#0F172A] dark:text-[#FAFAFA] shadow-xs"
                    : "text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-[#FAFAFA]",
                )}
              >
                {t.reports.periodThisMonth}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPeriod("last_month");
                  setSelectedCategoryFilter(null);
                }}
                className={cn(
                  "py-2 px-3 rounded-lg text-xs font-bold transition-all text-center cursor-pointer",
                  period === "last_month"
                    ? "bg-white dark:bg-[#121215] text-[#0F172A] dark:text-[#FAFAFA] shadow-xs"
                    : "text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-[#FAFAFA]",
                )}
              >
                {t.reports.periodLastMonth}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPeriod("this_year");
                  setSelectedCategoryFilter(null);
                }}
                className={cn(
                  "py-2 px-3 rounded-lg text-xs font-bold transition-all text-center cursor-pointer",
                  period === "this_year"
                    ? "bg-white dark:bg-[#121215] text-[#0F172A] dark:text-[#FAFAFA] shadow-xs"
                    : "text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-[#FAFAFA]",
                )}
              >
                {t.reports.periodThisYear}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPeriod("custom");
                  setSelectedCategoryFilter(null);
                }}
                className={cn(
                  "py-2 px-3 rounded-lg text-xs font-bold transition-all text-center cursor-pointer",
                  period === "custom"
                    ? "bg-white dark:bg-[#121215] text-[#0F172A] dark:text-[#FAFAFA] shadow-xs"
                    : "text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-[#FAFAFA]",
                )}
              >
                {t.reports.periodCustom}
              </button>
            </div>

            {/* Tag Dropdown Select Filter */}
            {availableTags.length > 0 && (
              <div className="w-full sm:w-44 shrink-0">
                <Select
                  value={selectedTag}
                  onValueChange={(val) => {
                    setSelectedTag(val);
                    setSelectedCategoryFilter(null);
                  }}
                >
                  <SelectTrigger className="h-[40px] text-xs font-semibold bg-white dark:bg-[#121215] border-[#E5E7EB] dark:border-[#27272A] rounded-xl px-3">
                    <div className="flex items-center gap-1.5 truncate">
                      <Hash className="w-3.5 h-3.5 text-[#64748B] shrink-0" />
                      <SelectValue
                        placeholder={
                          language === "en" ? "All Tags" : "Semua Tagar"
                        }
                      />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {language === "en" ? "All Tags" : "Semua Tagar"}
                    </SelectItem>
                    {availableTags.map((tag) => (
                      <SelectItem key={tag} value={tag}>
                        #{tag}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Custom Range Picker */}
          {period === "custom" && (
            <div className="p-3.5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-[#64748B] dark:text-[#94A3B8] flex items-center gap-1.5 shrink-0">
                <Calendar className="w-3.5 h-3.5" />
                <span>{t.reports.periodLabel}:</span>
              </span>
              <DateRangePicker
                startDate={customRange.start}
                endDate={customRange.end}
                onChange={(s, e) => setCustomRange({ start: s, end: e })}
                placeholder={t.reports.periodLabel}
              />
            </div>
          )}

          {/* Active Tag Pill Indicator */}
          {selectedTag !== "all" && (
            <div className="flex items-center gap-2 pt-0.5">
              <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8] font-medium">
                {language === "en"
                  ? "Filtered by tag:"
                  : "Difilter berdasarkan tagar:"}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#0F172A] text-white dark:bg-[#FAFAFA] dark:text-[#0F172A] text-xs font-bold font-mono">
                #{selectedTag}
                <button
                  type="button"
                  onClick={() => setSelectedTag("all")}
                  className="hover:opacity-75 cursor-pointer ml-0.5"
                  title={
                    language === "en"
                      ? "Clear tag filter"
                      : "Hapus filter tagar"
                  }
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            </div>
          )}
        </div>

        {/* Financial Health Scorecard (4 Responsive Cards) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Savings Rate */}
          <div className="p-4 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col justify-between gap-2 shadow-2xs">
            <div className="flex items-center justify-between gap-1 min-h-[28px]">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8] leading-tight">
                {t.reports.savingsRate}
              </span>
              <Percent className="w-3.5 h-3.5 text-[#64748B] dark:text-[#94A3B8] shrink-0" />
            </div>

            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black font-mono tracking-tight text-[#0F172A] dark:text-[#FAFAFA]">
                  {savingsRate >= 0
                    ? `+${savingsRate.toFixed(1)}%`
                    : `${savingsRate.toFixed(1)}%`}
                </span>
              </div>

              <div className="mt-2 flex items-center gap-1.5">
                {savingsRate >= 30 ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                    <Sparkles className="w-3 h-3" />
                    {t.reports.savingsRateHealthy}
                  </span>
                ) : savingsRate >= 10 ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                    <AlertTriangle className="w-3 h-3" />
                    {t.reports.savingsRateWarning}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                    <Flame className="w-3 h-3" />
                    {t.reports.savingsRateDeficit}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Card 2: Total Income */}
          <div className="p-4 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col justify-between gap-2 shadow-2xs">
            <div className="flex items-center justify-between gap-1 min-h-[28px]">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8] leading-tight">
                {t.reports.totalIncome}
              </span>
              <TrendingUp className="w-3.5 h-3.5 text-[#0D9488] shrink-0" />
            </div>

            <div>
              <h3
                className={cn(
                  "font-bold font-mono text-[#0D9488] tracking-tight tnum",
                  getCardFont(
                    formatCurrency(totalIncome, displayCurrency).length,
                  ),
                )}
              >
                +
                {maskCurrency(
                  formatCurrency(totalIncome, displayCurrency),
                  isPrivate,
                )}
              </h3>
              <div className="flex items-center gap-1 mt-1 text-[10px] font-mono text-[#94A3B8]">
                <span>vs {priorPeriodLabel}:</span>
                <span
                  className={cn(
                    "font-bold",
                    incomeGrowthPct >= 0 ? "text-[#0D9488]" : "text-[#E11D48]",
                  )}
                >
                  {incomeGrowthPct >= 0
                    ? `+${incomeGrowthPct.toFixed(1)}%`
                    : `${incomeGrowthPct.toFixed(1)}%`}
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Total Expense & Growth */}
          <div className="p-4 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col justify-between gap-2 shadow-2xs">
            <div className="flex items-center justify-between gap-1 min-h-[28px]">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8] leading-tight">
                {t.reports.totalExpense}
              </span>
              <TrendingDown className="w-3.5 h-3.5 text-[#E11D48] shrink-0" />
            </div>

            <div>
              <h3
                className={cn(
                  "font-bold font-mono text-[#E11D48] tracking-tight tnum",
                  getCardFont(
                    formatCurrency(totalExpense, displayCurrency).length,
                  ),
                )}
              >
                -
                {maskCurrency(
                  formatCurrency(totalExpense, displayCurrency),
                  isPrivate,
                )}
              </h3>
              <div className="flex items-center gap-1 mt-1 text-[10px] font-mono text-[#94A3B8]">
                <span>vs {priorPeriodLabel}:</span>
                <span
                  className={cn(
                    "font-bold",
                    expenseGrowthPct > 0 ? "text-[#E11D48]" : "text-[#0D9488]",
                  )}
                >
                  {expenseGrowthPct > 0
                    ? `+${expenseGrowthPct.toFixed(1)}%`
                    : `${expenseGrowthPct.toFixed(1)}%`}
                </span>
              </div>
            </div>
          </div>

          {/* Card 4: Daily Burn Rate & Net */}
          <div className="p-4 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col justify-between gap-2 shadow-2xs">
            <div className="flex items-center justify-between gap-1 min-h-[28px]">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8] leading-tight">
                {t.reports.dailyBurnRate}
              </span>
              <Flame className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            </div>

            <div>
              <h3
                className={cn(
                  "font-bold font-mono text-[#0F172A] dark:text-[#FAFAFA] tracking-tight tnum",
                  getCardFont(
                    formatCurrency(dailyBurnRate, displayCurrency).length,
                  ),
                )}
              >
                {maskCurrency(
                  formatCurrency(dailyBurnRate, displayCurrency),
                  isPrivate,
                )}
                <span className="text-[10px] font-normal text-[#94A3B8]">
                  /{language === "en" ? "day" : "hari"}
                </span>
              </h3>
              <span className="text-[10px] font-mono text-[#94A3B8] mt-1 block">
                {t.reports.netSavings}:{" "}
                {maskCurrency(
                  formatCurrency(netSavings, displayCurrency),
                  isPrivate,
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Side-by-Side Period Comparison Matrix */}
        <div className="p-5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-[#0F172A] dark:text-[#FAFAFA]" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#0F172A] dark:text-[#FAFAFA]">
                {language === "en"
                  ? "Side-by-Side Period Comparison"
                  : "Komparasi Kinerja Antar Periode"}
              </h2>
            </div>
            <span className="text-[10px] font-bold font-mono text-[#64748B] dark:text-[#94A3B8]">
              {currentPeriodLabel} vs {priorPeriodLabel}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
            {/* Income comparison */}
            <div className="p-3 rounded-lg bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-1">
              <span className="text-[10px] font-sans font-bold text-[#64748B] dark:text-[#94A3B8] uppercase">
                {t.quickAdd.income}
              </span>
              <span className="text-sm font-bold text-[#0D9488] tnum">
                +
                {maskCurrency(
                  formatCurrency(totalIncome, displayCurrency),
                  isPrivate,
                )}
              </span>
              <div className="flex items-center justify-between text-[10px] text-[#94A3B8] pt-1 border-t border-[#E5E7EB] dark:border-[#27272A] truncate">
                <span className="truncate">{priorPeriodLabel}:</span>
                <span className="shrink-0">
                  {maskCurrency(
                    formatCurrency(priorTotalIncome, displayCurrency),
                    isPrivate,
                  )}
                </span>
              </div>
            </div>

            {/* Expense comparison */}
            <div className="p-3 rounded-lg bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-1">
              <span className="text-[10px] font-sans font-bold text-[#64748B] dark:text-[#94A3B8] uppercase">
                {t.quickAdd.expense}
              </span>
              <span className="text-sm font-bold text-[#E11D48] tnum">
                -
                {maskCurrency(
                  formatCurrency(totalExpense, displayCurrency),
                  isPrivate,
                )}
              </span>
              <div className="flex items-center justify-between text-[10px] text-[#94A3B8] pt-1 border-t border-[#E5E7EB] dark:border-[#27272A] truncate">
                <span className="truncate">{priorPeriodLabel}:</span>
                <span className="shrink-0">
                  {maskCurrency(
                    formatCurrency(priorTotalExpense, displayCurrency),
                    isPrivate,
                  )}
                </span>
              </div>
            </div>

            {/* Net Surplus comparison */}
            <div className="p-3 rounded-lg bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-1">
              <span className="text-[10px] font-sans font-bold text-[#64748B] dark:text-[#94A3B8] uppercase">
                {language === "en" ? "Net Surplus" : "Surplus Bersih"}
              </span>
              <span
                className={cn(
                  "text-sm font-bold tnum",
                  netSavings >= 0 ? "text-[#0D9488]" : "text-[#E11D48]",
                )}
              >
                {maskCurrency(
                  formatCurrency(netSavings, displayCurrency),
                  isPrivate,
                )}
              </span>
              <div className="flex items-center justify-between text-[10px] text-[#94A3B8] pt-1 border-t border-[#E5E7EB] dark:border-[#27272A] truncate">
                <span className="truncate">{priorPeriodLabel}:</span>
                <span className="shrink-0">
                  {maskCurrency(
                    formatCurrency(priorNetSavings, displayCurrency),
                    isPrivate,
                  )}
                </span>
              </div>
            </div>

            {/* Savings Rate comparison */}
            <div className="p-3 rounded-lg bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-1">
              <span className="text-[10px] font-sans font-bold text-[#64748B] dark:text-[#94A3B8] uppercase">
                {t.reports.savingsRate}
              </span>
              <span className="text-sm font-bold text-[#0F172A] dark:text-[#FAFAFA] tnum">
                {savingsRate.toFixed(1)}%
              </span>
              <div className="flex items-center justify-between text-[10px] text-[#94A3B8] pt-1 border-t border-[#E5E7EB] dark:border-[#27272A] truncate">
                <span className="truncate">{priorPeriodLabel}:</span>
                <span className="shrink-0">{priorSavingsRate.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Cashflow Trajectory Trend Chart */}
        <div className="p-5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#0F172A] dark:text-[#FAFAFA]">
              {t.reports.cashflowTrendTitle}
            </h2>
            <div className="flex items-center gap-3 text-[10px] font-bold font-mono">
              <span className="flex items-center gap-1.5 text-[#0D9488]">
                <span className="w-2 h-2 rounded-full bg-[#0D9488]" />
                {t.quickAdd.income}
              </span>
              <span className="flex items-center gap-1.5 text-[#E11D48]">
                <span className="w-2 h-2 rounded-full bg-[#E11D48]" />
                {t.quickAdd.expense}
              </span>
            </div>
          </div>

          {timelineData.length === 0 ? (
            <div className="py-10 text-center text-xs text-[#94A3B8]">
              {t.reports.noDataDesc}
            </div>
          ) : (
            <div className="flex items-end justify-between gap-1.5 sm:gap-3 h-44 pt-4 pb-2 border-b border-[#E5E7EB] dark:border-[#27272A]">
              {timelineData.map((bar, idx) => {
                const incHeight = Math.max(
                  4,
                  (bar.income / maxTimelineVal) * 120,
                );
                const expHeight = Math.max(
                  4,
                  (bar.expense / maxTimelineVal) * 120,
                );
                return (
                  <div
                    key={idx}
                    className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group min-w-0"
                  >
                    <div className="w-full flex items-end justify-center gap-0.5 sm:gap-1 max-w-[28px] h-full">
                      {/* Income Bar */}
                      <div
                        style={{ height: `${incHeight}px` }}
                        className="w-1/2 bg-[#0D9488] rounded-t-xs hover:brightness-110 transition-all relative"
                        title={`Income: ${formatCurrency(bar.income, displayCurrency)}`}
                      />
                      {/* Expense Bar */}
                      <div
                        style={{ height: `${expHeight}px` }}
                        className="w-1/2 bg-[#E11D48] rounded-t-xs hover:brightness-110 transition-all relative"
                        title={`Expense: ${formatCurrency(bar.expense, displayCurrency)}`}
                      />
                    </div>
                    <span className="text-[9px] sm:text-[10px] font-mono text-[#94A3B8] truncate max-w-full text-center">
                      {bar.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Interactive Donut & Category Breakdown with Expense / Income Toggle */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Donut Chart Visualizer (5 Cols) */}
          <div className="lg:col-span-5 p-5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col items-center justify-between gap-4 shadow-2xs">
            <div className="w-full flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <PieChartIcon className="w-4 h-4 text-[#0F172A] dark:text-[#FAFAFA]" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#0F172A] dark:text-[#FAFAFA]">
                  {categoryTab === "expense"
                    ? language === "en"
                      ? "Expense Composition"
                      : "Komposisi Pengeluaran"
                    : language === "en"
                      ? "Income Composition"
                      : "Komposisi Pemasukan"}
                </h2>
              </div>
              {selectedCategoryFilter && (
                <button
                  onClick={() => setSelectedCategoryFilter(null)}
                  className="text-[10px] font-bold text-amber-500 hover:underline cursor-pointer shrink-0"
                >
                  {language === "en" ? "Reset" : "Reset"}
                </button>
              )}
            </div>

            {/* Expense vs Income Toggle Buttons */}
            <div className="flex items-center p-1 bg-[#F1F3F5] dark:bg-[#1A1A20] rounded-xl border border-[#E5E7EB] dark:border-[#27272A] w-full max-w-[240px]">
              <button
                type="button"
                onClick={() => {
                  setCategoryTab("expense");
                  setSelectedCategoryFilter(null);
                }}
                className={cn(
                  "flex-1 py-1.5 text-xs font-bold rounded-lg transition-all text-center cursor-pointer",
                  categoryTab === "expense"
                    ? "bg-white dark:bg-[#121215] text-[#E11D48] shadow-xs"
                    : "text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8]",
                )}
              >
                {t.quickAdd.expense}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCategoryTab("income");
                  setSelectedCategoryFilter(null);
                }}
                className={cn(
                  "flex-1 py-1.5 text-xs font-bold rounded-lg transition-all text-center cursor-pointer",
                  categoryTab === "income"
                    ? "bg-white dark:bg-[#121215] text-[#0D9488] shadow-xs"
                    : "text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8]",
                )}
              >
                {t.quickAdd.income}
              </button>
            </div>

            {categoryBreakdown.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#94A3B8]">
                {t.reports.noDataDesc}
              </div>
            ) : (
              <div className="relative flex items-center justify-center my-2">
                <svg
                  width="240"
                  height="240"
                  viewBox="0 0 240 240"
                  className="rotate-[-90deg]"
                >
                  {donutSlices.map((slice, idx) => (
                    <path
                      key={idx}
                      d={slice.pathData}
                      fill={slice.color}
                      onClick={() =>
                        setSelectedCategoryFilter(
                          selectedCategoryFilter === slice.id ? null : slice.id,
                        )
                      }
                      className={cn(
                        "cursor-pointer transition-all duration-200 hover:opacity-80",
                        selectedCategoryFilter === slice.id
                          ? "stroke-2 stroke-amber-400 brightness-110"
                          : "",
                      )}
                    />
                  ))}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4 max-w-[150px] mx-auto">
                  <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] leading-tight">
                    {selectedCategoryFilter
                      ? categoryBreakdown.find(
                          (c) => c.id === selectedCategoryFilter,
                        )?.category?.name || "Kategori"
                      : categoryTab === "expense"
                        ? language === "en"
                          ? "Total Expense"
                          : "Pengeluaran"
                        : language === "en"
                          ? "Total Income"
                          : "Pemasukan"}
                  </span>
                  <span
                    className={cn(
                      "font-black font-mono tracking-tight tnum mt-0.5 leading-tight",
                      categoryTab === "expense"
                        ? "text-[#E11D48]"
                        : "text-[#0D9488]",
                      "text-[11px] sm:text-xs",
                    )}
                  >
                    {selectedCategoryFilter
                      ? maskCurrency(
                          formatCurrency(
                            categoryBreakdown.find(
                              (c) => c.id === selectedCategoryFilter,
                            )?.total || 0,
                            displayCurrency,
                          ),
                          isPrivate,
                        )
                      : maskCurrency(
                          formatCurrency(
                            categoryTab === "expense"
                              ? totalExpense
                              : totalIncome,
                            displayCurrency,
                          ),
                          isPrivate,
                        )}
                  </span>
                  {selectedCategoryFilter && (
                    <span className="text-[9px] font-bold text-amber-500 font-mono mt-0.5">
                      {categoryBreakdown
                        .find((c) => c.id === selectedCategoryFilter)
                        ?.percentage.toFixed(1)}
                      %
                    </span>
                  )}
                </div>
              </div>
            )}

            <p className="text-[10px] text-[#64748B] dark:text-[#94A3B8] text-center">
              {language === "en"
                ? "Click a category arc to view transaction details."
                : "Klik segmen donat untuk melihat rincian transaksinya."}
            </p>
          </div>

          {/* Interactive Category List (7 Cols) */}
          <div className="lg:col-span-7 p-5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#0F172A] dark:text-[#FAFAFA]">
                {categoryTab === "expense"
                  ? t.reports.categoryBreakdownTitle
                  : language === "en"
                    ? "Income Category Breakdown"
                    : "Distribusi Sumber Pemasukan"}
              </h2>
              <span className="text-[10px] font-mono text-[#94A3B8]">
                {categoryBreakdown.length}{" "}
                {language === "en" ? "active categories" : "kategori aktif"}
              </span>
            </div>

            {categoryBreakdown.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#94A3B8]">
                {t.reports.noDataDesc}
              </div>
            ) : (
              <div className="flex flex-col gap-2.5 max-h-[340px] overflow-y-auto pr-1">
                {categoryBreakdown.map((cat, idx) => {
                  const isSelected = selectedCategoryFilter === cat.id;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() =>
                        setSelectedCategoryFilter(
                          selectedCategoryFilter === cat.id ? null : cat.id,
                        )
                      }
                      className={cn(
                        "flex flex-col gap-1.5 p-2.5 rounded-lg border text-left transition-colors cursor-pointer",
                        isSelected
                          ? "bg-[#F1F3F5] dark:bg-[#26262E] border-[#0F172A] dark:border-[#FAFAFA]"
                          : "bg-white dark:bg-[#121215] border-[#E5E7EB] dark:border-[#27272A] hover:bg-[#F8F9FA] dark:hover:bg-[#1A1A20]",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            style={{ backgroundColor: cat.color }}
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                          />
                          <div className="w-6 h-6 rounded-md bg-[#F1F3F5] dark:bg-[#1A1A20] flex items-center justify-center shrink-0 border border-[#E5E7EB] dark:border-[#27272A]">
                            <DynamicIcon
                              name={
                                cat.category?.icon ||
                                (categoryTab === "income"
                                  ? "TrendingUp"
                                  : "Tag")
                              }
                              className="w-3.5 h-3.5 text-[#0F172A] dark:text-[#FAFAFA]"
                            />
                          </div>
                          <span className="font-bold text-[#0F172A] dark:text-[#FAFAFA] truncate">
                            {cat.category?.name || t.common.custom}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 font-mono text-right shrink-0">
                          <span className="text-xs font-bold text-[#0F172A] dark:text-[#FAFAFA] tnum">
                            {maskCurrency(
                              formatCurrency(cat.total, displayCurrency),
                              isPrivate,
                            )}
                          </span>
                          <span className="text-[10px] font-bold text-[#64748B] dark:text-[#94A3B8] w-12 text-right">
                            {cat.percentage.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      {/* Progress Bar */}
                      <div className="w-full h-1.5 rounded-full bg-[#F1F3F5] dark:bg-[#1A1A20] overflow-hidden">
                        <div
                          style={{
                            width: `${Math.min(100, Math.max(2, cat.percentage))}%`,
                            backgroundColor: cat.color,
                          }}
                          className="h-full rounded-full transition-all duration-300"
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Drill-down Section when a Category is Selected */}
        {selectedCategoryFilter && (
          <div className="p-5 rounded-xl bg-white dark:bg-[#121215] border border-amber-300 dark:border-amber-700/60 flex flex-col gap-3 shadow-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>
                  {language === "en"
                    ? "Drilldown Transactions:"
                    : "Rincian Transaksi Kategori:"}{" "}
                  {categoryBreakdown.find(
                    (c) => c.id === selectedCategoryFilter,
                  )?.category?.name || t.common.custom}
                </span>
              </h3>
              <button
                onClick={() => setSelectedCategoryFilter(null)}
                className="text-xs text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#FAFAFA] cursor-pointer inline-flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                <span>{t.common.close}</span>
              </button>
            </div>

            <div className="divide-y divide-[#E5E7EB] dark:divide-[#27272A]">
              {displayedCategoryTransactions.map((tx) => {
                const cleanDesc = getCleanDescription(tx.description);
                return (
                  <div
                    key={tx.id}
                    className="py-2.5 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={cn(
                          "w-2 h-2 rounded-full shrink-0",
                          categoryTab === "income"
                            ? "bg-[#0D9488]"
                            : "bg-[#E11D48]",
                        )}
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-[#0F172A] dark:text-[#FAFAFA] truncate">
                          {cleanDesc || tx.category?.name || t.common.custom}
                        </span>
                        <span className="text-[10px] font-mono text-[#94A3B8]">
                          {format(
                            parseISO(tx.transaction_date),
                            "dd MMM yyyy",
                            { locale: dateFnsLocale },
                          )}{" "}
                          • {tx.account?.name}
                        </span>
                      </div>
                    </div>
                    <span
                      className={cn(
                        "font-bold font-mono shrink-0 tnum",
                        categoryTab === "income"
                          ? "text-[#0D9488]"
                          : "text-[#E11D48]",
                      )}
                    >
                      {categoryTab === "income" ? "+" : "-"}
                      {maskCurrency(
                        formatCurrency(tx.convertedAmount, displayCurrency),
                        isPrivate,
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Account Utilization & Top Expenses Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Account Utilization Card */}
          <div className="p-5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#0F172A] dark:text-[#FAFAFA]">
                {t.reports.accountBreakdownTitle}
              </h2>
              <span className="text-[10px] font-mono text-[#94A3B8]">
                {accountBreakdown.length}{" "}
                {language === "en" ? "accounts" : "rekening"}
              </span>
            </div>

            {accountBreakdown.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#94A3B8]">
                {t.reports.noDataDesc}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {accountBreakdown.map((acc, idx) => (
                  <div key={idx} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-md bg-[#F1F3F5] dark:bg-[#1A1A20] flex items-center justify-center shrink-0 border border-[#E5E7EB] dark:border-[#27272A]">
                          <Wallet className="w-3.5 h-3.5 text-[#0F172A] dark:text-[#FAFAFA]" />
                        </div>
                        <span className="font-bold text-[#0F172A] dark:text-[#FAFAFA] truncate">
                          {acc.account?.name || "Account"} (
                          {acc.account?.currency})
                        </span>
                      </div>
                      <div className="flex items-center gap-2 font-mono text-right shrink-0">
                        <span className="text-xs font-bold text-[#0F172A] dark:text-[#FAFAFA] tnum">
                          {maskCurrency(
                            formatCurrency(acc.total, displayCurrency),
                            isPrivate,
                          )}
                        </span>
                        <span className="text-[10px] text-[#94A3B8] w-10 text-right">
                          {acc.percentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-[#F1F3F5] dark:bg-[#1A1A20] overflow-hidden">
                      <div
                        style={{
                          width: `${Math.min(100, Math.max(2, acc.percentage))}%`,
                        }}
                        className="h-full bg-[#0D9488] rounded-full transition-all duration-300"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top Expenses */}
          <div className="p-5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#0F172A] dark:text-[#FAFAFA]">
                {t.reports.topExpensesTitle}
              </h2>
              <FileSpreadsheet className="w-4 h-4 text-[#94A3B8]" />
            </div>

            {topExpenses.length === 0 ? (
              <div className="py-6 text-center text-xs text-[#94A3B8]">
                {t.reports.noDataDesc}
              </div>
            ) : (
              <div className="divide-y divide-[#E5E7EB] dark:divide-[#27272A]">
                {topExpenses.slice(0, 5).map((tx) => {
                  const cleanDesc = getCleanDescription(tx.description);
                  return (
                    <div
                      key={tx.id}
                      className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-[#FFF1F2] dark:bg-[#881337]/20 border border-[#FECDD3] dark:border-[#9F1239]/40 flex items-center justify-center text-[#E11D48] shrink-0">
                          <DynamicIcon
                            name={tx.category?.icon || "ShoppingBag"}
                            className="w-4 h-4"
                          />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-bold text-[#0F172A] dark:text-[#FAFAFA] truncate">
                            {cleanDesc || tx.category?.name || t.common.custom}
                          </span>
                          <span className="text-[10px] font-mono text-[#94A3B8]">
                            {format(
                              parseISO(tx.transaction_date),
                              "dd MMM yyyy",
                              { locale: dateFnsLocale },
                            )}{" "}
                            • {tx.account?.name}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xs font-bold font-mono text-[#E11D48] tnum">
                          -
                          {maskCurrency(
                            formatCurrency(tx.convertedAmount, displayCurrency),
                            isPrivate,
                          )}
                        </span>
                        {tx.currency && tx.currency !== displayCurrency && (
                          <span className="text-[10px] font-mono text-[#94A3B8] block">
                            ({formatCurrency(tx.amount, tx.currency)})
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. PRINT-ONLY VIEW (Formal Document Layout - Never Clips or Slices)        */}
      {/* ========================================================================= */}
      <div className="hidden print:block print-only w-full">
        {/* Formal Header */}
        <div className="print-section border-b-2 border-slate-900 pb-4 mb-4">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900">
                POCKETLY
              </h1>
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mt-0.5">
                {language === "en"
                  ? "Personal Financial Statement & Cashflow Report"
                  : "Laporan Keuangan Pribadi & Arus Kas"}
              </p>
            </div>
            <div className="text-right font-mono text-xs text-slate-600">
              <div>
                <strong>{t.reports.periodLabel}:</strong>{" "}
                {format(intervalStart, "dd MMMM yyyy", {
                  locale: dateFnsLocale,
                })}{" "}
                –{" "}
                {format(intervalEnd, "dd MMMM yyyy", { locale: dateFnsLocale })}
              </div>
              <div className="mt-0.5">
                <strong>{t.reports.generatedOn}:</strong>{" "}
                {format(new Date(), "dd MMM yyyy, HH:mm")}
              </div>
              <div className="mt-0.5">
                <strong>Mata Uang Basis:</strong> {displayCurrency}
              </div>
            </div>
          </div>
        </div>

        {/* Section 1: Executive Summary */}
        <div className="print-section">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-2 border-b pb-1">
            1.{" "}
            {language === "en"
              ? "Executive Financial Summary"
              : "Ringkasan Eksekutif Keuangan"}
          </h2>
          <table className="text-xs">
            <thead>
              <tr className="bg-slate-100 font-bold text-slate-800">
                <th className="text-left">Metrik Finansial</th>
                <th className="text-right">Nominal ({displayCurrency})</th>
                <th className="text-left">Keterangan / Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="font-semibold text-emerald-800">
                  Total Pemasukan (Inflow)
                </td>
                <td className="text-right font-mono font-bold text-emerald-800 tnum">
                  +{formatCurrency(totalIncome, displayCurrency)}
                </td>
                <td>
                  {currentPeriodTx.filter((t) => t.type === "income").length}{" "}
                  transaksi pemasukan tercatat
                </td>
              </tr>
              <tr>
                <td className="font-semibold text-rose-800">
                  Total Pengeluaran (Outflow)
                </td>
                <td className="text-right font-mono font-bold text-rose-800 tnum">
                  -{formatCurrency(totalExpense, displayCurrency)}
                </td>
                <td>
                  {currentPeriodTx.filter((t) => t.type === "expense").length}{" "}
                  transaksi pengeluaran tercatat
                </td>
              </tr>
              <tr className="bg-slate-50 font-bold">
                <td>Surplus Bersih (Net Savings)</td>
                <td
                  className={cn(
                    "text-right font-mono tnum",
                    netSavings >= 0 ? "text-emerald-800" : "text-rose-800",
                  )}
                >
                  {netSavings >= 0 ? "+" : ""}
                  {formatCurrency(netSavings, displayCurrency)}
                </td>
                <td>
                  {netSavings >= 0
                    ? "Surplus (Pemasukan melebihi pengeluaran)"
                    : "Defisit (Pengeluaran melebihi pemasukan)"}
                </td>
              </tr>
              <tr>
                <td className="font-semibold">Rasio Tabungan (Savings Rate)</td>
                <td className="text-right font-mono font-bold tnum">
                  {savingsRate.toFixed(1)}%
                </td>
                <td>
                  {savingsRate >= 30
                    ? "Sangat Sehat (>30%)"
                    : savingsRate >= 10
                      ? "Waspada (10-30%)"
                      : "Defisit (<0%)"}
                </td>
              </tr>
              <tr>
                <td className="font-semibold">Rata-rata Pengeluaran Harian</td>
                <td className="text-right font-mono tnum">
                  {formatCurrency(dailyBurnRate, displayCurrency)} / hari
                </td>
                <td>Dihitung selama {elapsedDays} hari pada periode aktif</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Section 2: Side-by-Side Period Comparison */}
        <div className="print-section">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-2 border-b pb-1">
            2.{" "}
            {language === "en"
              ? "Period Performance Comparison"
              : "Komparasi Kinerja Antar Periode"}{" "}
            ({currentPeriodLabel} vs {priorPeriodLabel})
          </h2>
          <table className="text-xs">
            <thead>
              <tr className="bg-slate-100 font-bold text-slate-800">
                <th className="text-left">Pos Finansial</th>
                <th className="text-right">{currentPeriodLabel} (Aktif)</th>
                <th className="text-right">{priorPeriodLabel} (Lalu)</th>
                <th className="text-right">Pertumbuhan (%)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Total Pemasukan</td>
                <td className="text-right font-mono font-bold text-emerald-800 tnum">
                  +{formatCurrency(totalIncome, displayCurrency)}
                </td>
                <td className="text-right font-mono tnum">
                  +{formatCurrency(priorTotalIncome, displayCurrency)}
                </td>
                <td className="text-right font-mono font-bold tnum">
                  {incomeGrowthPct >= 0
                    ? `+${incomeGrowthPct.toFixed(1)}%`
                    : `${incomeGrowthPct.toFixed(1)}%`}
                </td>
              </tr>
              <tr>
                <td>Total Pengeluaran</td>
                <td className="text-right font-mono font-bold text-rose-800 tnum">
                  -{formatCurrency(totalExpense, displayCurrency)}
                </td>
                <td className="text-right font-mono tnum">
                  -{formatCurrency(priorTotalExpense, displayCurrency)}
                </td>
                <td className="text-right font-mono font-bold tnum">
                  {expenseGrowthPct >= 0
                    ? `+${expenseGrowthPct.toFixed(1)}%`
                    : `${expenseGrowthPct.toFixed(1)}%`}
                </td>
              </tr>
              <tr className="bg-slate-50 font-bold">
                <td>Surplus Bersih</td>
                <td className="text-right font-mono tnum">
                  {formatCurrency(netSavings, displayCurrency)}
                </td>
                <td className="text-right font-mono tnum">
                  {formatCurrency(priorNetSavings, displayCurrency)}
                </td>
                <td className="text-right font-mono tnum">-</td>
              </tr>
              <tr>
                <td>Rasio Tabungan</td>
                <td className="text-right font-mono tnum">
                  {savingsRate.toFixed(1)}%
                </td>
                <td className="text-right font-mono tnum">
                  {priorSavingsRate.toFixed(1)}%
                </td>
                <td className="text-right font-mono tnum">
                  {(savingsRate - priorSavingsRate).toFixed(1)}% pt
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Section 3: Expense Category Breakdown Table */}
        <div className="print-section">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-2 border-b pb-1">
            3.{" "}
            {language === "en"
              ? "Expense Category Breakdown"
              : "Rincian Distribusi Pengeluaran per Kategori"}{" "}
            ({allExpenseCategories.length} Kategori)
          </h2>
          <table className="text-xs">
            <thead>
              <tr className="bg-slate-100 font-bold text-slate-800">
                <th className="text-left w-8">No</th>
                <th className="text-left">Nama Kategori</th>
                <th className="text-center w-24">Jumlah Transaksi</th>
                <th className="text-right w-36">Total Pengeluaran</th>
                <th className="text-right w-24">Porsi (%)</th>
              </tr>
            </thead>
            <tbody>
              {allExpenseCategories.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center text-slate-400 py-4">
                    Tidak ada data pengeluaran
                  </td>
                </tr>
              ) : (
                allExpenseCategories.map((cat, idx) => (
                  <tr key={idx}>
                    <td>{idx + 1}</td>
                    <td className="font-semibold">
                      {cat.category?.name || "Lainnya"}
                    </td>
                    <td className="text-center font-mono">{cat.count}</td>
                    <td className="text-right font-mono font-bold tnum">
                      -{formatCurrency(cat.total, displayCurrency)}
                    </td>
                    <td className="text-right font-mono font-bold tnum">
                      {cat.percentage.toFixed(1)}%
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Section 4: Income Category Breakdown Table */}
        <div className="print-section">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-2 border-b pb-1">
            4.{" "}
            {language === "en"
              ? "Income Category Breakdown"
              : "Rincian Sumber Pemasukan per Kategori"}{" "}
            ({allIncomeCategories.length} Kategori)
          </h2>
          <table className="text-xs">
            <thead>
              <tr className="bg-slate-100 font-bold text-slate-800">
                <th className="text-left w-8">No</th>
                <th className="text-left">Sumber Pendapatan</th>
                <th className="text-center w-24">Jumlah Transaksi</th>
                <th className="text-right w-36">Total Pemasukan</th>
                <th className="text-right w-24">Porsi (%)</th>
              </tr>
            </thead>
            <tbody>
              {allIncomeCategories.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center text-slate-400 py-4">
                    Tidak ada data pemasukan
                  </td>
                </tr>
              ) : (
                allIncomeCategories.map((cat, idx) => (
                  <tr key={idx}>
                    <td>{idx + 1}</td>
                    <td className="font-semibold">
                      {cat.category?.name || "Lainnya"}
                    </td>
                    <td className="text-center font-mono">{cat.count}</td>
                    <td className="text-right font-mono font-bold text-emerald-800 tnum">
                      +{formatCurrency(cat.total, displayCurrency)}
                    </td>
                    <td className="text-right font-mono font-bold tnum">
                      {cat.percentage.toFixed(1)}%
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Section 5: Top 10 Largest Outflows */}
        <div className="print-section">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-2 border-b pb-1">
            5.{" "}
            {language === "en"
              ? "Top 10 Largest Outflows"
              : "Daftar 10 Pengeluaran Terbesar Periode Ini"}
          </h2>
          <table className="text-xs">
            <thead>
              <tr className="bg-slate-100 font-bold text-slate-800">
                <th className="text-left w-24">Tanggal</th>
                <th className="text-left">Keterangan / Pos</th>
                <th className="text-left">Kategori</th>
                <th className="text-left">Rekening</th>
                <th className="text-right w-36">Nominal</th>
              </tr>
            </thead>
            <tbody>
              {topExpenses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center text-slate-400 py-4">
                    Tidak ada transaksi
                  </td>
                </tr>
              ) : (
                topExpenses.map((tx) => {
                  const cleanDesc = getCleanDescription(tx.description);
                  return (
                    <tr key={tx.id}>
                      <td className="font-mono text-slate-600">
                        {format(parseISO(tx.transaction_date), "dd/MM/yyyy")}
                      </td>
                      <td className="font-semibold">
                        {cleanDesc || tx.category?.name || "-"}
                      </td>
                      <td>{tx.category?.name || "-"}</td>
                      <td className="text-slate-600">
                        {tx.account?.name || "-"}
                      </td>
                      <td className="text-right font-mono font-bold text-rose-800 tnum">
                        -{formatCurrency(tx.convertedAmount, displayCurrency)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Formal Footer */}
        <div className="print-section mt-8 pt-4 border-t text-center font-mono text-[9px] text-slate-400">
          Laporan ini dicetak secara otomatis oleh Pocketly Personal Financial
          Tracker • Rahasia & Khusus Pemilik Rekening
        </div>
      </div>
    </div>
  );
}
