"use client";

import React, { useState, useMemo, useRef, useCallback } from "react";
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
  ResponsiveContainer,
  ComposedChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
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
  endOfDay,
  isWeekend,
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
  CheckCircle2,
  PieChart as PieChartIcon,
  Scale,
  Hash,
  X,
  SlidersHorizontal,
  Search,
  Check,
  RotateCcw,
} from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import {
  ReportsPrintView,
  ReportPrintInsight,
} from "@/components/reports/reports-print-view";

interface ReportsViewProps {
  transactions: EnrichedTransaction[];
  categories: Category[];
  rates?: ForexRatesMap;
  stocks?: import("@/types/database").EnrichedStockHolding[];
  cryptos?: import("@/types/database").EnrichedCryptoHolding[];
  etfs?: import("@/types/database").EnrichedEtfHolding[];
  prices?: Array<{ kind: string; symbol: string; price: number; currency: string; fetchedAt: string }>;
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
  categories,
  rates,
  stocks = [],
  cryptos = [],
  etfs = [],
  prices = [],
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
  const [excludedCategoryIds, setExcludedCategoryIds] = useState<string[]>([]);
  const [isExcludeSheetOpen, setIsExcludeSheetOpen] = useState<boolean>(false);
  const [sheetCategoryType, setSheetCategoryType] = useState<
    "expense" | "income"
  >("expense");
  const [categorySearchQuery, setCategorySearchQuery] = useState<string>("");
  const [insightSlideIdx, setInsightSlideIdx] = useState(0);
  const INSIGHTS_PER_SLIDE = 4;

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

  const nowRef = useRef(new Date());
  const now = nowRef.current;

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
        end = customRange.end
          ? endOfDay(parseISO(customRange.end))
          : endOfMonth(now);
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
    }, [period, customRange, now]);

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
  // Helper to identify savings allocation / withdrawal transfers (not operational consumption)
  const isSavingsTransfer = (tx: {
    category?: { name?: string } | null;
    description?: string | null;
  }) => {
    const catName = (tx.category?.name || "").toLowerCase();
    const desc = tx.description || "";
    return (
      catName === "savings" ||
      catName === "tabungan" ||
      catName === "alokasi tabungan" ||
      desc.includes("[Ref:goal-") ||
      desc.startsWith("Alokasi Tabungan:") ||
      desc.startsWith("Penarikan Tabungan:")
    );
  };

  // Helper to identify if transaction belongs to an excluded category
  const isExcludedTx = useCallback(
    (tx: { category_id?: string | null }) => {
      const catId = tx.category_id || "uncategorized";
      return excludedCategoryIds.includes(catId);
    },
    [excludedCategoryIds],
  );

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
      // Exclude savings goal deposits/withdrawals from operational burn/revenue
      if (isSavingsTransfer(tx)) {
        return;
      }
      if (isExcludedTx(tx)) {
        return;
      }

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
    // For the current (still running) period, only elapsed days count —
    // dividing by the full month/year would understate the burn rate.
    const nowDate = new Date();
    const effectiveEnd = intervalEnd > nowDate ? nowDate : intervalEnd;
    const days = Math.max(
      1,
      differenceInCalendarDays(effectiveEnd, intervalStart) + 1,
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
  }, [
    currentPeriodTx,
    displayCurrency,
    rates,
    intervalStart,
    intervalEnd,
    isExcludedTx,
  ]);

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
      if (isSavingsTransfer(tx)) {
        return;
      }
      if (isExcludedTx(tx)) {
        return;
      }

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
  }, [priorPeriodTx, displayCurrency, rates, isExcludedTx]);

  const expenseGrowthPct = useMemo(() => {
    if (priorTotalExpense === 0) return totalExpense > 0 ? 100 : 0;
    return ((totalExpense - priorTotalExpense) / priorTotalExpense) * 100;
  }, [totalExpense, priorTotalExpense]);

  const incomeGrowthPct = useMemo(() => {
    if (priorTotalIncome === 0) return totalIncome > 0 ? 100 : 0;
    return ((totalIncome - priorTotalIncome) / priorTotalIncome) * 100;
  }, [totalIncome, priorTotalIncome]);

  // Expense Categories Breakdown (Always full for print & screen, excludes savings transfers & excluded categories)
  const allExpenseCategories = useMemo(() => {
    const map = new Map<
      string,
      { id: string; category: Category | null; total: number; count: number }
    >();
    currentPeriodTx.forEach((tx) => {
      if (
        tx.type === "expense" &&
        !isSavingsTransfer(tx) &&
        !isExcludedTx(tx)
      ) {
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
  }, [
    currentPeriodTx,
    totalExpense,
    displayCurrency,
    rates,
    isExcludedTx,
  ]);

  // Income Categories Breakdown (Always full for print & screen, excludes savings withdrawals & excluded categories)
  const allIncomeCategories = useMemo(() => {
    const map = new Map<
      string,
      { id: string; category: Category | null; total: number; count: number }
    >();
    currentPeriodTx.forEach((tx) => {
      if (tx.type === "income" && !isSavingsTransfer(tx) && !isExcludedTx(tx)) {
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
  }, [
    currentPeriodTx,
    totalIncome,
    displayCurrency,
    rates,
    isExcludedTx,
  ]);

  // Active Category Breakdown for interactive Donut / List
  const categoryBreakdown = useMemo(() => {
    return categoryTab === "expense"
      ? allExpenseCategories
      : allIncomeCategories;
  }, [categoryTab, allExpenseCategories, allIncomeCategories]);

  // Raw Category Breakdown for Bottom Sheet Category Exclude Modal (unfiltered by exclusion)
  const rawCategorySummary = useMemo(() => {
    const expenseMap = new Map<
      string,
      {
        id: string;
        name: string;
        category: Category | null;
        total: number;
        count: number;
      }
    >();
    const incomeMap = new Map<
      string,
      {
        id: string;
        name: string;
        category: Category | null;
        total: number;
        count: number;
      }
    >();

    currentPeriodTx.forEach((tx) => {
      if (isSavingsTransfer(tx)) return;
      const catId = tx.category_id || "uncategorized";
      const catName = tx.category?.name || t.reports.uncategorized;

      const converted = convertAmount(
        tx.amount,
        tx.currency || tx.account?.currency || "IDR",
        displayCurrency,
        rates,
      );

      const targetMap = tx.type === "expense" ? expenseMap : incomeMap;
      const existing = targetMap.get(catId) || {
        id: catId,
        name: catName,
        category: tx.category || null,
        total: 0,
        count: 0,
      };
      existing.total += converted;
      existing.count += 1;
      targetMap.set(catId, existing);
    });

    return {
      expense: Array.from(expenseMap.values()).sort(
        (a, b) => b.total - a.total,
      ),
      income: Array.from(incomeMap.values()).sort((a, b) => b.total - a.total),
    };
  }, [currentPeriodTx, displayCurrency, rates, t.reports.uncategorized]);

  // Aggregate Excluded Totals and Meta Info for Banners and Quick Insights
  const {
    totalExcludedExpense,
    totalExcludedIncome,
    excludedExpenseCount,
    excludedIncomeCount,
    excludedCategoryNames,
  } = useMemo(() => {
    let expSum = 0;
    let incSum = 0;
    const expCats = new Set<string>();
    const incCats = new Set<string>();
    const catNames: string[] = [];

    currentPeriodTx.forEach((tx) => {
      if (isSavingsTransfer(tx)) return;
      const catId = tx.category_id || "uncategorized";
      if (excludedCategoryIds.includes(catId)) {
        const val = convertAmount(
          tx.amount,
          tx.currency || tx.account?.currency || "IDR",
          displayCurrency,
          rates,
        );
        const name = tx.category?.name || t.reports.uncategorized;
        if (!catNames.includes(name)) catNames.push(name);

        if (tx.type === "expense") {
          expSum += val;
          expCats.add(catId);
        } else {
          incSum += val;
          incCats.add(catId);
        }
      }
    });

    excludedCategoryIds.forEach((id) => {
      if (id === "uncategorized") {
        const name = t.reports.uncategorized;
        if (!catNames.includes(name)) catNames.push(name);
      } else {
        const found = categories.find((c) => c.id === id);
        if (found && !catNames.includes(found.name)) {
          catNames.push(found.name);
        }
      }
    });

    return {
      totalExcludedExpense: expSum,
      totalExcludedIncome: incSum,
      excludedExpenseCount: expCats.size,
      excludedIncomeCount: incCats.size,
      excludedCategoryNames: catNames,
    };
  }, [
    currentPeriodTx,
    excludedCategoryIds,
    displayCurrency,
    rates,
    categories,
    t.reports.uncategorized,
  ]);

  const filteredSheetCategories = useMemo(() => {
    const list =
      sheetCategoryType === "expense"
        ? rawCategorySummary.expense
        : rawCategorySummary.income;
    if (!categorySearchQuery.trim()) return list;
    const q = categorySearchQuery.toLowerCase();
    return list.filter((item) => item.name.toLowerCase().includes(q));
  }, [sheetCategoryType, rawCategorySummary, categorySearchQuery]);

  const toggleExcludeCategory = (catId: string) => {
    setExcludedCategoryIds((prev) =>
      prev.includes(catId)
        ? prev.filter((id) => id !== catId)
        : [...prev, catId],
    );
    if (selectedCategoryFilter === catId) {
      setSelectedCategoryFilter(null);
    }
  };

  // Account Breakdown Aggregation
  const accountBreakdown = useMemo(() => {
    const map = new Map<
      string,
      { account: Account | null; total: number; count: number }
    >();

    currentPeriodTx.forEach((tx) => {
      if (
        tx.type === "expense" &&
        !isSavingsTransfer(tx) &&
        !isExcludedTx(tx)
      ) {
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
  }, [
    currentPeriodTx,
    totalExpense,
    displayCurrency,
    rates,
    isExcludedTx,
  ]);

  // Filtered Transactions (By Selected Category from Donut)
  const displayedCategoryTransactions = useMemo(() => {
    if (
      !selectedCategoryFilter ||
      excludedCategoryIds.includes(selectedCategoryFilter)
    )
      return [];
    return currentPeriodTx
      .filter(
        (tx) =>
          (tx.category_id || "uncategorized") === selectedCategoryFilter &&
          tx.type === categoryTab &&
          !isExcludedTx(tx),
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
    isExcludedTx,
    excludedCategoryIds,
  ]);

  // Top 5 / Top 10 Expenses
  const topExpenses = useMemo(() => {
    return [...currentPeriodTx]
      .filter(
        (tx) =>
          tx.type === "expense" && !isSavingsTransfer(tx) && !isExcludedTx(tx),
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
      .sort((a, b) => b.convertedAmount - a.convertedAmount)
      .slice(0, 10);
  }, [currentPeriodTx, displayCurrency, rates, isExcludedTx]);

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
          if (isSavingsTransfer(tx) || isExcludedTx(tx)) return;
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

      // If 1 month period (this_month / last_month) -> divide by 7 days (weekly: ~4-5 groups)
      // For other custom intervals -> dynamically cap to maximum 8 groups (16 bars total)
      const maxGroups = 8;
      const step =
        period === "this_month" || period === "last_month"
          ? 7
          : Math.max(1, Math.ceil(allDays.length / maxGroups));

      const chunks: { label: string; income: number; expense: number }[] = [];

      for (let i = 0; i < allDays.length; i += step) {
        const chunkDays = allDays.slice(i, i + step);
        const cStart = chunkDays[0];
        const cEnd = chunkDays[chunkDays.length - 1];
        let inc = 0;
        let exp = 0;

        currentPeriodTx.forEach((tx) => {
          if (isSavingsTransfer(tx) || isExcludedTx(tx)) return;
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

        const isSameMonth =
          cStart.getMonth() === cEnd.getMonth() &&
          cStart.getFullYear() === cEnd.getFullYear();

        const labelText =
          chunkDays.length > 1
            ? isSameMonth
              ? `${format(cStart, "d")}-${format(cEnd, "d MMM", { locale: dateFnsLocale })}`
              : `${format(cStart, "d MMM", { locale: dateFnsLocale })}-${format(cEnd, "d MMM", { locale: dateFnsLocale })}`
            : format(cStart, "d MMM", { locale: dateFnsLocale });

        chunks.push({
          label: labelText,
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
    isExcludedTx,
  ]);

  // Donut SVG — full donut with gap between slices (like Net Worth).
  // Coordinates are rounded to 2 decimals so server & client render
  // the exact same path string (avoids hydration mismatch from
  // floating-point last-digit differences in Math.cos/sin).
  const donutSlices = useMemo(() => {
    const center = 120;
    const outerR = 104;
    const innerR = 82;
    const GAP = 2; // degrees between slices
    const r2 = (n: number) => Math.round(n * 100) / 100;
    const slices: ((typeof categoryBreakdown)[number] & { pathData: string })[] =
      [];

    if (categoryBreakdown.length === 1) {
      const cat = categoryBreakdown[0];
      slices.push({
        ...cat,
        pathData: `M ${center} ${center - outerR} A ${outerR} ${outerR} 0 1 1 ${center} ${center + outerR} A ${outerR} ${outerR} 0 1 1 ${center} ${center - outerR} L ${center} ${center - innerR} A ${innerR} ${innerR} 0 1 0 ${center} ${center + innerR} A ${innerR} ${innerR} 0 1 0 ${center} ${center - innerR} Z`,
      });
      return slices;
    }

    let cumulative = 0;
    for (let i = 0; i < categoryBreakdown.length; i++) {
      const cat = categoryBreakdown[i];
      const startPct = cumulative;
      cumulative += cat.percentage;
      const endPct = cumulative;
      const startAngle = (startPct / 100) * 360 + GAP / 2;
      const endAngle = (endPct / 100) * 360 - GAP / 2;

      const startRad = ((startAngle - 90) * Math.PI) / 180;
      const endRad = ((endAngle - 90) * Math.PI) / 180;

      const x1 = r2(center + outerR * Math.cos(startRad));
      const y1 = r2(center + outerR * Math.sin(startRad));
      const x2 = r2(center + outerR * Math.cos(endRad));
      const y2 = r2(center + outerR * Math.sin(endRad));

      const ix1 = r2(center + innerR * Math.cos(startRad));
      const iy1 = r2(center + innerR * Math.sin(startRad));
      const ix2 = r2(center + innerR * Math.cos(endRad));
      const iy2 = r2(center + innerR * Math.sin(endRad));

      const largeArc = endAngle - startAngle > 180 ? 1 : 0;

      const pathData = `M ${x1} ${y1} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix1} ${iy1} Z`;

      slices.push({
        ...cat,
        pathData,
      });
    }

    return slices;
  }, [categoryBreakdown]);

  // Export CSV
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleExportCSV = () => {
    const headers = [
      t.reports.csvDate,
      t.reports.csvType,
      t.reports.csvCategory,
      t.reports.csvAccount,
      t.reports.csvAmount,
      t.reports.csvCurrency,
      t.reports.csvNormalizedAmount,
      t.reports.csvDisplayCurrency,
      t.reports.csvTags,
      t.reports.csvDescription,
    ];
    const rows = currentPeriodTx
      .filter((tx) => !isExcludedTx(tx))
      .map((tx) => [
        format(parseISO(tx.transaction_date), "yyyy-MM-dd HH:mm"),
        tx.type,
        tx.category?.name || t.reports.uncategorized,
        tx.account?.name || t.reports.unknown,
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

  // Smart Financial Insights & Highlights Heuristics
  const smartInsights = useMemo(() => {
    interface SmartInsightItem extends ReportPrintInsight {
      id: string;
      type: "positive" | "warning" | "danger" | "highlight" | "neutral";
      icon: React.ReactNode;
      title: string;
      badge: string;
      description: string;
      containerClassName: string;
      iconBoxClassName: string;
      badgeClassName: string;
    }

    const insights: SmartInsightItem[] = [];

    const getStyles = () => ({
      containerClassName:
        "bg-[#F8F9FA] dark:bg-[#1A1A20] border-[#E5E7EB] dark:border-[#27272A]",
      iconBoxClassName:
        "bg-white dark:bg-[#121215] text-[#0F172A] dark:text-[#FAFAFA] border border-[#E5E7EB] dark:border-[#27272A]",
      badgeClassName:
        "bg-white dark:bg-[#121215] text-[#0F172A] dark:text-[#FAFAFA] border border-[#E5E7EB] dark:border-[#27272A]",
    });

    // 1. Savings Rate / Buffer Health Evaluation
    if (totalIncome > 0 || totalExpense > 0) {
      if (savingsRate >= 30) {
        insights.push({
          id: "savings-health-positive",
          type: "positive",
          icon: <CheckCircle2 className="w-3.5 h-3.5" />,
          title: t.reports.insightSavingsRateHealthTitle,
          badge: t.reports.savingsRateHealthy,
          description: t.reports.insightSavingsRateHealthyDesc.replace(
            "{rate}",
            savingsRate.toFixed(1)
          ),
          ...getStyles(),
        });
      } else if (savingsRate < 0 && totalExpense > 0) {
        insights.push({
          id: "savings-health-deficit",
          type: "danger",
          icon: <AlertTriangle className="w-3.5 h-3.5" />,
          title: t.reports.insightSavingsRateHealthTitle,
          badge: t.reports.savingsRateDeficit,
          description: t.reports.insightSavingsRateDeficitDesc.replace(
            "{amount}",
            maskCurrency(
              formatCurrency(Math.abs(netSavings), displayCurrency),
              isPrivate
            )
          ),
          ...getStyles(),
        });
      } else if (savingsRate >= 0 && savingsRate < 20 && totalIncome > 0) {
        insights.push({
          id: "savings-health-warning",
          type: "warning",
          icon: <AlertTriangle className="w-3.5 h-3.5" />,
          title: t.reports.insightSavingsRateHealthTitle,
          badge: t.reports.savingsRateWarning,
          description: t.reports.insightSavingsRateWarningDesc.replace(
            "{rate}",
            savingsRate.toFixed(1)
          ),
          ...getStyles(),
        });
      }
    }

    // 2. Category Outflow Surge / Spike vs Prior Period
    const priorExpenseMap = new Map<string, number>();
    priorPeriodTx.forEach((tx) => {
      if (tx.type === "expense" && !isSavingsTransfer(tx) && !isExcludedTx(tx)) {
        const catId = tx.category_id || "uncategorized";
        const val = convertAmount(
          tx.amount,
          tx.currency || tx.account?.currency || "IDR",
          displayCurrency,
          rates
        );
        priorExpenseMap.set(catId, (priorExpenseMap.get(catId) || 0) + val);
      }
    });

    const categorySpikes: {
      name: string;
      growth: number;
      diff: number;
    }[] = [];

    allExpenseCategories.forEach((cat) => {
      const priorVal = priorExpenseMap.get(cat.id) || 0;
      if (cat.total > priorVal) {
        const diff = cat.total - priorVal;
        const isNewCategory = priorVal === 0;
        const growth = isNewCategory || priorVal === 0 ? 100 : ((cat.total - priorVal) / priorVal) * 100;
        if ((isNewCategory ? diff >= totalExpense * 0.1 : growth >= 25 && diff >= totalExpense * 0.05)) {
          categorySpikes.push({
            name: cat.category?.name || t.reports.uncategorized,
            growth,
            diff,
          });
        }
      }
    });

    if (categorySpikes.length > 0) {
      categorySpikes.sort((a, b) => b.diff - a.diff);
      categorySpikes.slice(0, 2).forEach((spike, idx) => {
        insights.push({
          id: `category-spike-${idx}`,
          type: "warning",
          icon: <TrendingUp className="w-3.5 h-3.5" />,
          title: t.reports.insightSpikeTitle,
          badge: `+${spike.growth.toFixed(0)}%`,
          description: t.reports.insightSpikeDesc
            .replace("{category}", spike.name)
            .replace("{growth}", spike.growth.toFixed(1))
            .replace(
              "{diff}",
              maskCurrency(
                formatCurrency(spike.diff, displayCurrency),
                isPrivate
              )
            ),
          ...getStyles(),
        });
      });
    }

    // 3. Dominant Expense Category (>35% of total outflow)
    if (allExpenseCategories.length > 0 && totalExpense > 0) {
      const topCat = allExpenseCategories[0];
      if (topCat.percentage >= 35) {
        insights.push({
          id: "dominant-category",
          type: "highlight",
          icon: <PieChartIcon className="w-3.5 h-3.5" />,
          title: t.reports.insightDominantCategoryTitle,
          badge: `${topCat.percentage.toFixed(0)}% Total`,
          description: t.reports.insightDominantCategoryDesc
            .replace(
              "{category}",
              topCat.category?.name || t.reports.uncategorized
            )
            .replace("{pct}", topCat.percentage.toFixed(1))
            .replace(
              "{amount}",
              maskCurrency(
                formatCurrency(topCat.total, displayCurrency),
                isPrivate
              )
            ),
          ...getStyles(),
        });
      }
    }

    // 4. Weekend vs Weekday Spending Pattern
    const daysInInterval = eachDayOfInterval({
      start: intervalStart,
      end: intervalEnd,
    });
    let weekendDaysCount = 0;
    let weekdayDaysCount = 0;
    daysInInterval.forEach((d) => {
      if (isWeekend(d)) weekendDaysCount++;
      else weekdayDaysCount++;
    });

    if (weekendDaysCount >= 2 && weekdayDaysCount >= 3 && totalExpense > 0) {
      let weekendExpense = 0;
      let weekdayExpense = 0;

      currentPeriodTx.forEach((tx) => {
        if (
          tx.type === "expense" &&
          !isSavingsTransfer(tx) &&
          !isExcludedTx(tx)
        ) {
          const d = parseISO(tx.transaction_date);
          const val = convertAmount(
            tx.amount,
            tx.currency || tx.account?.currency || "IDR",
            displayCurrency,
            rates
          );
          if (isWeekend(d)) {
            weekendExpense += val;
          } else {
            weekdayExpense += val;
          }
        }
      });

      const avgWeekend = weekendExpense / weekendDaysCount;
      const avgWeekday = weekdayExpense / weekdayDaysCount;

      if (avgWeekday > 0 && avgWeekend > 0) {
        const multiplier = avgWeekend / avgWeekday;
        if (multiplier >= 1.5 && weekendExpense >= totalExpense * 0.25) {
          insights.push({
            id: "weekend-spending-pattern",
            type: "warning",
            icon: <Calendar className="w-3.5 h-3.5" />,
            title: t.reports.insightWeekendTitle,
            badge: t.reports.insightWeekendBadge.replace(
              "{multiplier}",
              multiplier.toFixed(1)
            ),
            description: t.reports.insightWeekendDesc.replace(
              "{multiplier}",
              multiplier.toFixed(1)
            ),
            ...getStyles(),
          });
        }
      }
    }

    // 5. Daily Burn Rate Trend vs Prior Period
    const priorDays = Math.max(
      1,
      differenceInCalendarDays(priorIntervalEnd, priorIntervalStart) + 1
    );
    const priorBurnRate = priorTotalExpense / priorDays;

    if (priorBurnRate > 0 && dailyBurnRate > 0) {
      const burnDiff = dailyBurnRate - priorBurnRate;
      const burnPct = (burnDiff / priorBurnRate) * 100;

      if (burnPct <= -10) {
        insights.push({
          id: "burn-rate-improvement",
          type: "positive",
          icon: <CheckCircle2 className="w-3.5 h-3.5" />,
          title: t.reports.insightBurnRateImprovementTitle,
          badge: `${burnPct.toFixed(0)}% ${t.reports.perDay}`,
          description: t.reports.insightBurnRateImprovementDesc
            .replace(
              "{amount}",
              maskCurrency(
                formatCurrency(Math.abs(burnDiff), displayCurrency),
                isPrivate
              )
            )
            .replace("{pct}", Math.abs(burnPct).toFixed(1)),
          ...getStyles(),
        });
      } else if (burnPct >= 20 && Math.abs(burnDiff) >= 10000) {
        insights.push({
          id: "burn-rate-spike",
          type: "warning",
          icon: <TrendingUp className="w-3.5 h-3.5" />,
          title: t.reports.insightBurnRateSpikeTitle,
          badge: `+${burnPct.toFixed(0)}% ${t.reports.perDay}`,
          description: t.reports.insightBurnRateSpikeDesc
            .replace(
              "{amount}",
              maskCurrency(
                formatCurrency(Math.abs(burnDiff), displayCurrency),
                isPrivate
              )
            )
            .replace("{pct}", burnPct.toFixed(1)),
          ...getStyles(),
        });
      }
    }

    // 6. Single Big Ticket Outflow Event
    if (topExpenses.length > 0 && totalExpense > 0) {
      const topTx = topExpenses[0];
      const bigTicketPct = (topTx.convertedAmount / totalExpense) * 100;
      if (bigTicketPct >= 28 && topExpenses.length > 1) {
        const cleanDesc =
          getCleanDescription(topTx.description) ||
          topTx.category?.name ||
          t.common.custom;
        insights.push({
          id: "big-ticket-outflow",
          type: "highlight",
          icon: <Wallet className="w-3.5 h-3.5" />,
          title: t.reports.insightBigTicketTitle,
          badge: `${bigTicketPct.toFixed(0)}% Total`,
          description: t.reports.insightBigTicketDesc
            .replace("{desc}", cleanDesc)
            .replace(
              "{amount}",
              maskCurrency(
                formatCurrency(topTx.convertedAmount, displayCurrency),
                isPrivate
              )
            )
            .replace("{pct}", bigTicketPct.toFixed(1)),
          ...getStyles(),
        });
      }
    }

    // 7. No-Spend Days Discipline
    const effectiveEnd = intervalEnd > now ? now : intervalEnd;
    if (intervalStart <= effectiveEnd) {
      const elapsedDaysInterval = eachDayOfInterval({
        start: intervalStart,
        end: effectiveEnd,
      });
      if (elapsedDaysInterval.length >= 7) {
        const daysWithExpense = new Set<string>();
        currentPeriodTx.forEach((tx) => {
          if (
            tx.type === "expense" &&
            !isSavingsTransfer(tx) &&
            !isExcludedTx(tx)
          ) {
            daysWithExpense.add(
              format(parseISO(tx.transaction_date), "yyyy-MM-dd")
            );
          }
        });

        let noSpendCount = 0;
        elapsedDaysInterval.forEach((d) => {
          const formatted = format(d, "yyyy-MM-dd");
          if (!daysWithExpense.has(formatted)) {
            noSpendCount++;
          }
        });

        if (noSpendCount >= 3) {
          insights.push({
            id: "no-spend-days",
            type: "positive",
            icon: <Calendar className="w-3.5 h-3.5" />,
            title: t.reports.insightNoSpendDaysTitle,
            badge: t.reports.insightNoSpendBadge.replace(
              "{count}",
              String(noSpendCount)
            ),
            description: t.reports.insightNoSpendDaysDesc.replace(
              "{count}",
              String(noSpendCount)
            ),
            ...getStyles(),
          });
        }
      }
    }

    // Fallback if no specific condition met, provide a balanced summary if there are transactions
    if (insights.length === 0 && (totalIncome > 0 || totalExpense > 0)) {
      insights.push({
        id: "balanced-insight",
        type: "neutral",
        icon: <CheckCircle2 className="w-3.5 h-3.5" />,
        title: t.reports.insightBalancedTitle,
        badge: t.reports.activePeriod,
        description: t.reports.insightBalancedDesc,
        ...getStyles(),
      });
    }

    return insights;
  }, [
    totalIncome,
    totalExpense,
    netSavings,
    savingsRate,
    dailyBurnRate,
    priorTotalExpense,
    priorIntervalStart,
    priorIntervalEnd,
    allExpenseCategories,
    priorPeriodTx,
    currentPeriodTx,
    displayCurrency,
    rates,
    isPrivate,
    intervalStart,
    intervalEnd,
    topExpenses,
    now,
    t,
    isExcludedTx,
  ]);

  // PDF beneran via jsPDF + autoTable (dari data, bukan screenshot DOM)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const handlePrint = async () => {
    setIsGeneratingPdf(true);
    try {
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 14;
      const textWidth = pageWidth - margin * 2;
      const fmtAmt = (n: number) => formatCurrency(n, displayCurrency);
      let y = margin;

      const addSection = (title: string) => {
        const pageHeight = doc.internal.pageSize.getHeight();
        if (y > pageHeight - 35) {
          doc.addPage();
          y = margin;
        }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text(title, margin, y);
        y += 6;
        doc.setDrawColor(15, 23, 42);
        doc.setLineWidth(0.4);
        doc.line(margin, y, pageWidth - margin, y);
        y += 5;
      };

      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("POCKETLY", margin, y);
      y += 5;
      doc.setFontSize(11);
      doc.text(t.reports.statementHeader, margin, y);
      y += 4;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(
        `${t.reports.pdfPeriod}: ${format(intervalStart, "dd MMMM yyyy", { locale: dateFnsLocale })} - ${format(intervalEnd, "dd MMMM yyyy", { locale: dateFnsLocale })}`,
        margin,
        y,
      );
      y += 4;
      doc.text(
        `${t.reports.pdfGenerated}: ${format(new Date(), "dd MMM yyyy, HH:mm")} | ${t.reports.pdfCurrency}: ${displayCurrency}`,
        margin,
        y,
      );
      y += 8;

      const tableOpts = {
        startY: y,
        theme: "grid" as const,
        styles: { fontSize: 8, cellPadding: 1.5 },
        headStyles: {
          fillColor: [241, 245, 249] as [number, number, number],
          textColor: [15, 23, 42] as [number, number, number],
          fontStyle: "bold" as const,
        },
        margin: { left: margin, right: margin },
      };

      addSection(`1. ${t.reports.summarySection}`);
      autoTable(doc, {
        ...tableOpts,
        startY: y,
        head: [["Metric", `Amount (${displayCurrency})`]],
        body: [
          [t.reports.totalIncome, `+${fmtAmt(totalIncome)}`],
          [t.reports.totalExpense, `-${fmtAmt(totalExpense)}`],
          [t.reports.pdfNetSavings, fmtAmt(netSavings)],
          [t.reports.savingsRate, `${savingsRate.toFixed(1)}%`],
          [t.reports.pdfDailyExpense, `${fmtAmt(dailyBurnRate)} ${t.reports.perDay}`],
        ],
      });
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

      if (smartInsights.length > 0) {
        addSection(`2. ${t.reports.smartInsightsTitle}`);
        doc.setFontSize(8);
        smartInsights.forEach((ins) => {
          doc.setFont("helvetica", "bold");
          const title = `${ins.title} [${ins.badge}]`;
          const lines = doc.splitTextToSize(`${title} — ${ins.description}`, textWidth);
          if (y + lines.length * 4 > 280) doc.addPage();
          doc.text(lines, margin, y);
          y += lines.length * 4 + 4;
        });
        y += 4;
      }

      addSection(`3. ${t.reports.pdfPeriodComparison} (${currentPeriodLabel} vs ${priorPeriodLabel})`);
      autoTable(doc, {
        ...tableOpts,
        startY: y,
        head: [["", currentPeriodLabel, priorPeriodLabel]],
        body: [
          [t.reports.totalIncomeLabel, `+${fmtAmt(totalIncome)}`, `+${fmtAmt(priorTotalIncome)}`],
          [t.reports.totalExpenseLabel, `-${fmtAmt(totalExpense)}`, `-${fmtAmt(priorTotalExpense)}`],
          [t.reports.pdfNetSavingsShort, fmtAmt(netSavings), fmtAmt(priorNetSavings)],
        ],
      });
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

      const addCategoryTable = (title: string, cats: typeof allExpenseCategories) => {
        addSection(title);
        autoTable(doc, {
          ...tableOpts,
          startY: y,
          head: [["#", t.reports.pdfCategory, t.reports.pdfCount, t.reports.nominal, t.reports.pdfShare]],
          body: cats.map((c, i) => [
            String(i + 1),
            c.category?.name || t.reports.pdfUncategorized,
            String(c.count),
            fmtAmt(c.total),
            `${c.percentage.toFixed(1)}%`,
          ]),
        });
        y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
      };
      addCategoryTable(`4. ${t.reports.pdfExpenseBreakdown}`, allExpenseCategories);
      addCategoryTable(`5. ${t.reports.pdfIncomeBreakdown}`, allIncomeCategories);

      addSection(`6. ${t.reports.pdfTopOutflows}`);
      autoTable(doc, {
        ...tableOpts,
        startY: y,
        head: [["Date", t.reports.csvDescription, t.reports.pdfCategory, t.reports.csvAccount, t.reports.nominal]],
        body: topExpenses.slice(0, 10).map((tx) => [
          format(parseISO(tx.transaction_date), "dd/MM/yyyy"),
          getCleanDescription(tx.description) || tx.category?.name || "-",
          tx.category?.name || "-",
          tx.account?.name || "-",
          `-${fmtAmt(tx.convertedAmount)}`,
        ]),
      });
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

      // Holdings snapshot (paling bawah)
      const holdingRows = [
        ...stocks.map((h) => ({
          kind: t.reports.pdfStockKind,
          symbol: h.ticker,
          qty: `${Number(h.lots) || Number(h.total_shares) / 100} lot`,
          cost: convertAmount(Number(h.total_cost) || 0, h.currency || h.account?.currency || "IDR", displayCurrency, rates),
        })),
        ...cryptos.map((h) => ({
          kind: t.reports.pdfCryptoKind,
          symbol: h.symbol,
          qty: `${Number(h.quantity)} ${h.symbol}`,
          cost: convertAmount(Number(h.cost_basis) || 0, h.price_currency || "IDR", displayCurrency, rates),
        })),
        ...etfs.map((h) => ({
          kind: t.reports.pdfEtfKind,
          symbol: h.ticker,
          qty: `${Number(h.quantity)} unit`,
          cost: convertAmount(Number(h.total_cost) || 0, h.currency || h.account?.currency || "IDR", displayCurrency, rates),
        })),
      ];
      if (holdingRows.length > 0) {
        addSection(`7. ${t.reports.pdfPortfolioHoldings}`);
        const totalH = holdingRows.reduce((s, r) => s + r.cost, 0);
        autoTable(doc, {
          ...tableOpts,
          startY: y,
          head: [[t.reports.pdfAsset, t.reports.pdfQuantity, t.reports.pdfCost, t.reports.pdfShare]],
          body: holdingRows.map((r) => [ `${r.kind} ${r.symbol}`, r.qty, fmtAmt(r.cost), totalH > 0 ? `${((r.cost / totalH) * 100).toFixed(1)}%` : "—" ]),
        });
        y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
      }

      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(t.reports.pdfFooter, margin, y + 4);
      pdfSave(doc);
    } catch (e) {
      console.error("Failed to generate PDF:", e);
    } finally {
      setIsGeneratingPdf(false);
    }

    function pdfSave(pdfDoc: InstanceType<typeof import("jspdf").jsPDF>) {
      pdfDoc.save(
        `Pocketly-Financial-Report-${format(intervalStart, "MMM-yyyy", { locale: dateFnsLocale })}.pdf`,
      );
    }
  };

  // Dynamic Auto-scale helper
  const getCardFont = (strLen: number) => {
    if (strLen > 18) return "text-[11px] sm:text-xs";
    if (strLen > 13) return "text-xs sm:text-sm";
    return "text-sm sm:text-base";
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
              onClick={handlePrint}
              size="sm"
              disabled={isGeneratingPdf}
              className="gap-1.5 cursor-pointer text-xs font-bold bg-[#0F172A] dark:bg-[#FAFAFA] text-white dark:text-[#0F172A]"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{isGeneratingPdf ? "…" : t.reports.printBtn}</span>
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

            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
              {/* Tag Dropdown Select Filter */}
              {availableTags.length > 0 && (
                <div className="flex-1 sm:w-44 shrink-0">
                  <Select
                    value={selectedTag}
                    onValueChange={(val) => {
                      setSelectedTag(val);
                      setSelectedCategoryFilter(null);
                    }}
                  >
                    <SelectTrigger className="h-10 text-xs font-semibold bg-white dark:bg-[#121215] border-[#E5E7EB] dark:border-[#27272A] rounded-xl px-3">
                      <div className="flex items-center gap-1.5 truncate">
                        <Hash className="w-3.5 h-3.5 text-[#64748B] shrink-0" />
                        <SelectValue placeholder={t.reports.allTags} />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t.reports.allTags}</SelectItem>
                      {availableTags.map((tag) => (
                        <SelectItem key={tag} value={tag}>
                          #{tag}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Exclude Categories Trigger Button */}
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSheetCategoryType(categoryTab);
                  setIsExcludeSheetOpen(true);
                }}
                className={cn(
                  "h-10 px-3 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 shrink-0 cursor-pointer transition-colors",
                  availableTags.length === 0 ? "w-full sm:w-auto" : "",
                  excludedCategoryIds.length > 0
                    ? "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400 font-bold"
                    : "bg-white dark:bg-[#121215] border-[#E5E7EB] dark:border-[#27272A] text-[#0F172A] dark:text-[#FAFAFA]",
                )}
                title={t.reports.excludeCategoriesTitle}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>{t.reports.exclude}</span>
                {excludedCategoryIds.length > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-amber-500 text-white font-bold">
                    {excludedCategoryIds.length}
                  </span>
                )}
              </Button>
            </div>
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
                {t.reports.filteredByTag}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#0F172A] text-white dark:bg-[#FAFAFA] dark:text-[#0F172A] text-xs font-bold font-mono">
                #{selectedTag}
                <button
                  type="button"
                  onClick={() => setSelectedTag("all")}
                  className="hover:opacity-75 cursor-pointer ml-0.5"
                  title={t.reports.clearTagFilter}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            </div>
          )}

          {/* Active Category Exclusion Warning Banner */}
          {excludedCategoryIds.length > 0 && (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-start sm:items-center gap-2.5 text-amber-900 dark:text-amber-200 min-w-0">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5 sm:mt-0" />
                <div className="truncate">
                  <span className="font-bold">
                    {excludedCategoryIds.length} {t.reports.categoriesExcluded}
                  </span>
                  <span className="mx-1.5 opacity-60">•</span>
                  <span className="text-[11px] text-amber-700 dark:text-amber-300">
                    {categoryTab === "expense"
                      ? `${t.reports.hiddenExpense}: ${maskCurrency(formatCurrency(totalExcludedExpense, displayCurrency), isPrivate)}`
                      : `${t.reports.hiddenIncome}: ${maskCurrency(formatCurrency(totalExcludedIncome, displayCurrency), isPrivate)}`}
                  </span>
                  {excludedCategoryNames.length > 0 && (
                    <span className="hidden md:inline text-[11px] text-amber-600/80 dark:text-amber-400/80 ml-1.5 truncate">
                      ({excludedCategoryNames.slice(0, 3).join(", ")}
                      {excludedCategoryNames.length > 3 ? "..." : ""})
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => {
                    setSheetCategoryType(categoryTab);
                    setIsExcludeSheetOpen(true);
                  }}
                  className="text-xs font-semibold text-amber-800 dark:text-amber-300 underline hover:opacity-80 cursor-pointer"
                >
                  {t.reports.adjust}
                </button>
                <button
                  type="button"
                  onClick={() => setExcludedCategoryIds([])}
                  className="text-xs font-bold px-2.5 py-1 rounded-lg bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-100 hover:bg-amber-300 dark:hover:bg-amber-900 cursor-pointer transition-colors"
                >
                  {t.reports.resetAll}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Financial Health Scorecard (4 Responsive Cards) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Savings Rate */}
          <div className="p-4 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col justify-between gap-2 shadow-2xs">
            <div className="flex items-center justify-between gap-1 min-h-7">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8] leading-tight">
                {t.reports.savingsRate}
              </span>
              <Percent className="w-3.5 h-3.5 text-[#64748B] dark:text-[#94A3B8] shrink-0" />
            </div>

            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-black font-mono tracking-tight text-[#0F172A] dark:text-[#FAFAFA]">
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
            <div className="flex items-center justify-between gap-1 min-h-7">
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
            <div className="flex items-center justify-between gap-1 min-h-7">
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
            <div className="flex items-center justify-between gap-1 min-h-7">
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
                  {t.reports.perDay}
                </span>
              </h3>
            </div>
          </div>
        </div>

        {/* Smart Financial Insights & Highlights Section */}
        <div className="p-5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-3.5 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-[#F1F3F5] dark:bg-[#1A1A20] flex items-center justify-center text-[#0F172A] dark:text-[#FAFAFA] border border-[#E5E7EB] dark:border-[#27272A] shrink-0">
                <TrendingUp className="w-3.5 h-3.5" />
              </div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#0F172A] dark:text-[#FAFAFA]">
                {t.reports.smartInsightsTitle}
              </h2>
            </div>
            <span className="text-[10px] text-[#64748B] dark:text-[#94A3B8] font-mono">
              {t.reports.smartInsightsSubtitle}
            </span>
          </div>

          {smartInsights.length === 0 ? (
            <div className="py-6 text-center text-xs text-[#94A3B8]">
              {t.reports.noInsightsDesc}
            </div>
          ) : (
            <>
              <div
                className="grid grid-cols-1 md:grid-cols-2 gap-3"
                onTouchStart={(e) => {
                  const target = e.currentTarget as HTMLDivElement & { _touchX?: number };
                  target._touchX = e.touches[0].clientX;
                }}
                onTouchEnd={(e) => {
                  const target = e.currentTarget as HTMLDivElement & { _touchX?: number };
                  const startX = target._touchX;
                  if (startX === undefined) return;
                  const dx = e.changedTouches[0].clientX - startX;
                  const totalSlides = Math.ceil(smartInsights.length / INSIGHTS_PER_SLIDE);
                  if (dx < -40) setInsightSlideIdx((i) => Math.min(totalSlides - 1, i + 1));
                  else if (dx > 40) setInsightSlideIdx((i) => Math.max(0, i - 1));
                }}
              >
              {(() => {
                const totalSlides = Math.ceil(smartInsights.length / INSIGHTS_PER_SLIDE);
                const safeIdx = Math.min(insightSlideIdx, totalSlides - 1);
                const pageInsights = smartInsights.slice(safeIdx * INSIGHTS_PER_SLIDE, safeIdx * INSIGHTS_PER_SLIDE + INSIGHTS_PER_SLIDE);
                return pageInsights.map((insight) => (
                <div
                  key={insight.id}
                  className={cn(
                    "p-3.5 rounded-xl border flex flex-col justify-between gap-2.5 transition-all",
                    insight.containerClassName
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={cn(
                          "w-6 h-6 rounded-lg flex items-center justify-center shrink-0",
                          insight.iconBoxClassName
                        )}
                      >
                        {insight.icon}
                      </div>
                      <h3 className="text-xs font-bold text-[#0F172A] dark:text-[#FAFAFA] truncate">
                        {insight.title}
                      </h3>
                    </div>
                    <span
                      className={cn(
                        "text-[10px] font-bold font-mono px-2 py-0.5 rounded-md shrink-0 uppercase tracking-wider",
                        insight.badgeClassName
                      )}
                    >
                      {insight.badge}
                    </span>
                  </div>

                  <p className="text-xs text-[#475569] dark:text-[#CBD5E1] leading-relaxed">
                    {insight.description}
                  </p>
                </div>
                ));
              })()}
              </div>

              {(() => {
                const totalSlides = Math.ceil(smartInsights.length / INSIGHTS_PER_SLIDE);
                if (totalSlides <= 1) return null;
                const safeIdx = Math.min(insightSlideIdx, totalSlides - 1);
                return (
                  <div className="flex items-center justify-center gap-1.5 pt-1">
                    {Array.from({ length: totalSlides }).map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setInsightSlideIdx(i)}
                        aria-label={`Slide ${i + 1}`}
                        className={cn(
                          "h-1.5 rounded-full transition-all",
                          i === safeIdx ? "w-5 bg-[#0F172A] dark:bg-[#FAFAFA]" : "w-1.5 bg-[#E5E7EB] dark:bg-[#3F3F46]",
                        )}
                      />
                    ))}
                  </div>
                );
              })()}
            </>
          )}
        </div>

        {/* Side-by-Side Period Comparison Matrix */}
        <div className="p-5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-[#0F172A] dark:text-[#FAFAFA]" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#0F172A] dark:text-[#FAFAFA]">
                {t.reports.periodComparison}
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
                {t.reports.netSavings}
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
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart
                data={timelineData}
                margin={{ top: 4, right: 4, left: 4, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="rpIncomeFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0D9488" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#0D9488" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="rpExpenseFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#E11D48" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#E11D48" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 9, fill: "#94A3B8" }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={24}
                  tickMargin={4}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: "#94A3B8" }}
                  axisLine={false}
                  tickLine={false}
                  width={44}
                  tickFormatter={(v: number) =>
                    isPrivate
                      ? "•••"
                      : formatCurrency(v, displayCurrency, { compact: true }).replace(/^(Rp|\$|S\$)\s?/, "")
                  }
                />
                <Tooltip
                  labelFormatter={(label) => String(label ?? "")}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const point = payload[0]?.payload as
                      | { income?: number; expense?: number }
                      | undefined;
                    const income = Number(point?.income ?? 0);
                    const expense = Number(point?.expense ?? 0);
                    const net = income - expense;
                    const netColor =
                      net >= 0 ? "#0D9488" : "#E11D48";
                    const fmtVal = (v: number) =>
                      isPrivate
                        ? "••••"
                        : formatCurrency(v, displayCurrency);
                    return (
                      <div
                        style={{ fontSize: 11, borderRadius: 12 }}
                        className="border border-[#E5E7EB] bg-white px-2.5 py-2 shadow-lg dark:border-[#27272A] dark:bg-[#121215]"
                      >
                        <div className="mb-1 font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                          {String(label ?? "")}
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-[#0D9488]">{t.quickAdd.income}</span>
                          <span className="font-mono font-bold text-[#0D9488] tnum">
                            {fmtVal(income)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-[#E11D48]">{t.quickAdd.expense}</span>
                          <span className="font-mono font-bold text-[#E11D48] tnum">
                            {fmtVal(expense)}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-4 border-t border-[#E5E7EB] pt-1 dark:border-[#27272A]">
                          <span className="text-[#64748B] dark:text-[#94A3B8]">
                            {t.reports.netLabel}
                          </span>
                          <span
                            className="font-mono font-bold tnum"
                            style={{ color: netColor }}
                          >
                            {net > 0 && "+"}
                            {fmtVal(net)}
                          </span>
                        </div>
                      </div>
                    );
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="income"
                  name={t.quickAdd.income}
                  stroke="#0D9488"
                  strokeWidth={2}
                  fill="url(#rpIncomeFill)"
                  dot={timelineData.length <= 8}
                  activeDot={{ r: 3 }}
                />
                <Area
                  type="monotone"
                  dataKey="expense"
                  name={t.quickAdd.expense}
                  stroke="#E11D48"
                  strokeWidth={2}
                  fill="url(#rpExpenseFill)"
                  dot={timelineData.length <= 8}
                  activeDot={{ r: 3 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
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
                    ? t.reports.expenseComposition
                    : t.reports.incomeComposition}
                </h2>
              </div>
              {selectedCategoryFilter && (
                <button
                  onClick={() => setSelectedCategoryFilter(null)}
                  className="text-[10px] font-bold text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-[#FAFAFA] hover:underline cursor-pointer shrink-0"
                >
                  {t.reports.reset}
                </button>
              )}
            </div>

            {/* Expense vs Income Toggle Buttons */}
            <div className="flex items-center p-1 bg-[#F1F3F5] dark:bg-[#1A1A20] rounded-xl border border-[#E5E7EB] dark:border-[#27272A] w-full max-w-60">
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
                  className="select-none"
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
                        "cursor-pointer transition-opacity duration-200 hover:opacity-85",
                        selectedCategoryFilter &&
                          selectedCategoryFilter !== slice.id &&
                          "opacity-25",
                      )}
                    />
                  ))}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4 max-w-37.5 mx-auto">
                  <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] leading-tight">
                    {selectedCategoryFilter
                      ? categoryBreakdown.find(
                          (c) => c.id === selectedCategoryFilter,
                        )?.category?.name || "Kategori"
                      : categoryTab === "expense"
                        ? t.reports.totalExpenseShort
                        : t.reports.totalIncomeShort}
                  </span>
                  <span
                    className={cn(
                      "font-black font-mono tracking-tight tnum mt-0.5 leading-tight",
                      categoryTab === "expense"
                        ? "text-[#E11D48]"
                        : "text-[#0D9488]",
                      "text-xs sm:text-sm",
                    )}
                  >
                    {(() => {
                      const v = selectedCategoryFilter
                        ? categoryBreakdown.find(
                            (c) => c.id === selectedCategoryFilter,
                          )?.total || 0
                        : categoryTab === "expense"
                          ? totalExpense
                          : totalIncome;
                      const full = maskCurrency(
                        formatCurrency(v, displayCurrency),
                        isPrivate,
                      );
                      // Donut hole here is 164px wide (vs 124px in Net Worth),
                      // so full amounts fit at this font size — only compact
                      // when really long, like Net Worth does.
                      return full.length > 20
                        ? maskCurrency(
                            formatCurrency(v, displayCurrency, { compact: true }),
                            isPrivate,
                          )
                        : full;
                    })()}
                  </span>
                  {selectedCategoryFilter && (
                    <span className="text-[9px] font-bold text-[#0F172A] dark:text-[#FAFAFA] font-mono mt-0.5">
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
              {t.reports.clickCategoryArc}
            </p>
          </div>

          {/* Interactive Category List (7 Cols) */}
          <div className="lg:col-span-7 p-5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#0F172A] dark:text-[#FAFAFA]">
                {categoryTab === "expense"
                  ? t.reports.categoryBreakdownTitle
                  : t.reports.incomeCategoryBreakdownPrint}
              </h2>
              <span className="text-[10px] font-mono text-[#94A3B8]">
                {categoryBreakdown.length} {t.reports.activeCategories}
              </span>
            </div>

            {categoryBreakdown.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#94A3B8]">
                {t.reports.noDataDesc}
              </div>
            ) : (
              <div className="flex flex-col gap-2.5 max-h-85 overflow-y-auto pr-1">
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

            {/* Excluded categories count indicator at bottom of category list */}
            {excludedCategoryIds.length > 0 && (
              <div className="pt-2 border-t border-[#E5E7EB] dark:border-[#27272A] flex items-center justify-between text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                <span>
                  {excludedCategoryIds.length} {t.reports.categoriesExcluded}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSheetCategoryType(categoryTab);
                    setIsExcludeSheetOpen(true);
                  }}
                  className="text-amber-600 dark:text-amber-400 font-bold hover:underline cursor-pointer"
                >
                  {t.common.actions}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Drill-down Section when a Category is Selected */}
        {selectedCategoryFilter && (
          <div className="p-5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#0F172A] dark:text-[#FAFAFA] flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#0D9488]" />
                <span>
                  {t.reports.drilldownTransactions}{" "}
                  {categoryBreakdown.find(
                    (c) => c.id === selectedCategoryFilter,
                  )?.category?.name || t.common.custom}
                </span>
              </h3>
              <button
                onClick={() => setSelectedCategoryFilter(null)}
                className="text-xs text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-[#FAFAFA] cursor-pointer inline-flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-[#F1F3F5] dark:hover:bg-[#1A1A20] transition-colors"
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
                {accountBreakdown.length} {t.reports.accounts}
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
                          {acc.account?.name || t.reports.accountFallback} (
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

        {/* Kepemilikan Portofolio — paling bawah, snapshot terakhir (tidak difilter tanggal) */}
        {(stocks.length > 0 || cryptos.length > 0 || etfs.length > 0) && (
          <div className="p-5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-3 shadow-2xs">
            {(() => {
              const priceMap = new Map(
                prices.map((p) => [`${p.kind}:${p.symbol.toUpperCase()}`, p]),
              );
              const fmtFetched = (iso?: string | null) =>
                iso
                  ? new Date(iso).toLocaleString(
                      language === "en" ? "en-US" : "id-ID",
                      {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      },
                    )
                  : null;
              const marketOrCost = (
                kind: "stock" | "crypto" | "etf",
                symbol: string,
                quantity: number,
                costIdr: number,
              ): { valueIdr: number; fetchedAt: string | null } => {
                const cached = priceMap.get(`${kind}:${symbol.toUpperCase()}`);
                if (!cached || cached.price <= 0 || quantity <= 0) {
                  return { valueIdr: costIdr, fetchedAt: null };
                }
                return {
                  valueIdr: convertAmount(
                    quantity * cached.price,
                    cached.currency,
                    "IDR",
                    rates,
                  ),
                  fetchedAt: cached.fetchedAt || null,
                };
              };
              const rows = [
                ...stocks.map((h) => {
                  const settlementCurrency = h.currency || h.account?.currency || "IDR";
                  const costIdr = convertAmount(Number(h.total_cost) || 0, settlementCurrency, "IDR", rates);
                  const shares =
                    Number((h as { total_shares?: number }).total_shares) ||
                    Number(h.lots || 0) * 100 ||
                    0;
                  const mv = marketOrCost("stock", h.ticker || "", shares, costIdr);
                  return {
                    kind: t.reports.pdfStockKind,
                    symbol: h.ticker,
                    settlementCurrency,
                    qtyText: `${Number(h.lots) || Number(h.total_shares) / 100} lot (${Number(h.total_shares) || 0} lbr)`,
                    cost: costIdr,
                    valueIdr: mv.valueIdr,
                    fetchedAt: mv.fetchedAt,
                  };
                }),
                ...cryptos.map((h) => {
                  const settlementCurrency = h.price_currency || "IDR";
                  const costIdr = convertAmount(Number(h.cost_basis) || 0, settlementCurrency, "IDR", rates);
                  const mv = marketOrCost("crypto", h.symbol || "", Number(h.quantity) || 0, costIdr);
                  return {
                    kind: t.reports.pdfCryptoKind,
                    symbol: h.symbol,
                    settlementCurrency,
                    qtyText: `${Number(h.quantity)} ${h.symbol}`,
                    cost: costIdr,
                    valueIdr: mv.valueIdr,
                    fetchedAt: mv.fetchedAt,
                  };
                }),
                ...etfs.map((h) => {
                  const settlementCurrency = h.currency || h.account?.currency || "IDR";
                  const costIdr = convertAmount(Number(h.total_cost) || 0, settlementCurrency, "IDR", rates);
                  const mv = marketOrCost("etf", h.ticker || "", Number(h.quantity) || 0, costIdr);
                  return {
                    kind: t.reports.pdfEtfKind,
                    symbol: h.ticker,
                    settlementCurrency,
                    qtyText: `${Number(h.quantity)} unit`,
                    cost: costIdr,
                    valueIdr: mv.valueIdr,
                    fetchedAt: mv.fetchedAt,
                  };
                }),
              ].map((r) => ({
                ...r,
                costDisplay: convertAmount(r.valueIdr, "IDR", displayCurrency, rates),
              }));
              const totalHoldingsCost = rows.reduce((s, r) => s + r.costDisplay, 0);
              const latestFetched = rows.reduce<string | null>(
                (m, r) => (r.fetchedAt && (!m || r.fetchedAt > m) ? r.fetchedAt : m),
                null,
              );
              const latestFetchedLabel = fmtFetched(latestFetched);
              return (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-[#F1F3F5] dark:bg-[#1A1A20] flex items-center justify-center text-[#0F172A] dark:text-[#FAFAFA] border border-[#E5E7EB] dark:border-[#27272A] shrink-0">
                        <Wallet className="w-3.5 h-3.5" />
                      </div>
                      <h2 className="text-xs font-bold uppercase tracking-wider text-[#0F172A] dark:text-[#FAFAFA]">
                        {t.reports.portfolioHoldingsTitle}
                      </h2>
                    </div>
                    <span className="text-[10px] text-[#64748B] dark:text-[#94A3B8] font-mono">
                      {latestFetchedLabel
                        ? `${language === "en" ? "Prices as of" : "Harga per"} ${latestFetchedLabel}`
                        : t.reports.snapshotToday}
                    </span>
                  </div>
                  <div className="divide-y divide-[#E5E7EB] dark:divide-[#27272A]">
                    {rows.map((r, i) => (
                      <div key={`${r.kind}-${r.symbol}-${i}`} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-black text-xs text-[#0F172A] dark:text-[#F8FAFC]">{r.symbol}</span>
                            <span className="rounded-md bg-[#F1F3F5] px-1.5 py-0.5 text-[9px] font-bold text-[#64748B] dark:bg-[#27272A] dark:text-[#94A3B8]">{r.kind}</span>
                          </div>
                          <p className="truncate text-[10px] text-[#64748B] dark:text-[#94A3B8]">{r.qtyText}</p>
                          {r.fetchedAt && (
                            <p className="truncate text-[9px] text-[#94A3B8]">
                              {language === "en" ? "Market" : "Harga"} {fmtFetched(r.fetchedAt)}
                            </p>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-mono text-xs font-black text-[#0F172A] dark:text-[#F8FAFC]">
                            {maskCurrency(formatCurrency(r.costDisplay, displayCurrency), isPrivate)}
                          </p>
                          <p className="font-mono text-[9px] text-[#94A3B8]">
                            {totalHoldingsCost > 0 ? `${((r.costDisplay / totalHoldingsCost) * 100).toFixed(1)}%` : "—"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* PDF print view */}
      <ReportsPrintView
        intervalStart={intervalStart}
        intervalEnd={intervalEnd}
        dateFnsLocale={dateFnsLocale}
        displayCurrency={displayCurrency}
        currentPeriodLabel={currentPeriodLabel}
        priorPeriodLabel={priorPeriodLabel}
        currentPeriodTx={currentPeriodTx}
        totalIncome={totalIncome}
        totalExpense={totalExpense}
        netSavings={netSavings}
        savingsRate={savingsRate}
        dailyBurnRate={dailyBurnRate}
        elapsedDays={elapsedDays}
        smartInsights={smartInsights}
        priorTotalIncome={priorTotalIncome}
        priorTotalExpense={priorTotalExpense}
        priorNetSavings={priorNetSavings}
        priorSavingsRate={priorSavingsRate}
        incomeGrowthPct={incomeGrowthPct}
        expenseGrowthPct={expenseGrowthPct}
        allExpenseCategories={allExpenseCategories}
        allIncomeCategories={allIncomeCategories}
        topExpenses={topExpenses}
        excludedCategoryIds={excludedCategoryIds}
        excludedCategoryNames={excludedCategoryNames}
      />
      {/* Exclude Categories Bottom Sheet / Modal (Responsive Mobile Drawer & Desktop Dialog) */}
      <BottomSheet
        isOpen={isExcludeSheetOpen}
        onClose={() => {
          setIsExcludeSheetOpen(false);
          setCategorySearchQuery("");
        }}
        title={t.reports.excludeCategoriesTitle}
      >
        <div className="flex flex-col gap-3">
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
            {t.reports.excludeCategoriesDesc}
          </p>

          {/* Type Switcher (Pengeluaran / Pemasukan) */}
          <div className="flex items-center p-1 bg-[#F1F3F5] dark:bg-[#1A1A20] rounded-xl border border-[#E5E7EB] dark:border-[#27272A] w-full">
            <button
              type="button"
              onClick={() => setSheetCategoryType("expense")}
              className={cn(
                "flex-1 py-1.5 text-xs font-bold rounded-lg transition-all text-center cursor-pointer flex items-center justify-center gap-1.5",
                sheetCategoryType === "expense"
                  ? "bg-white dark:bg-[#121215] text-[#E11D48] shadow-xs"
                  : "text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8]",
              )}
            >
              <span>{t.reports.expenses}</span>
              {excludedExpenseCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-[#E11D48] text-white">
                  {excludedExpenseCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setSheetCategoryType("income")}
              className={cn(
                "flex-1 py-1.5 text-xs font-bold rounded-lg transition-all text-center cursor-pointer flex items-center justify-center gap-1.5",
                sheetCategoryType === "income"
                  ? "bg-white dark:bg-[#121215] text-[#0D9488] shadow-xs"
                  : "text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8]",
              )}
            >
              <span>{t.reports.income}</span>
              {excludedIncomeCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-[#0D9488] text-white">
                  {excludedIncomeCount}
                </span>
              )}
            </button>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input
              type="text"
              placeholder={t.reports.searchCategoryPlaceholder}
              value={categorySearchQuery}
              onChange={(e) => setCategorySearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs rounded-xl bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] focus:outline-none focus:ring-1 focus:ring-[#0F172A] dark:focus:ring-[#FAFAFA] text-[#0F172A] dark:text-[#FAFAFA]"
            />
            {categorySearchQuery && (
              <button
                type="button"
                onClick={() => setCategorySearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#FAFAFA]"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* List Meta & Quick Action */}
          <div className="flex items-center justify-between text-[11px] text-[#64748B] dark:text-[#94A3B8] px-0.5 pt-1">
            <span>
              {filteredSheetCategories.length} {t.reports.activeCategories}
            </span>
            {excludedCategoryIds.length > 0 && (
              <button
                type="button"
                onClick={() => setExcludedCategoryIds([])}
                className="text-amber-600 dark:text-amber-400 font-bold hover:underline cursor-pointer flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>{t.reports.resetAll}</span>
              </button>
            )}
          </div>

          {/* Scrollable Categories List */}
          <div className="max-h-75 overflow-y-auto space-y-2 pr-1">
            {filteredSheetCategories.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#94A3B8]">
                {t.reports.noDataDesc}
              </div>
            ) : (
              filteredSheetCategories.map((cat) => {
                const isExcluded = excludedCategoryIds.includes(cat.id);
                return (
                  <div
                    key={cat.id}
                    onClick={() => toggleExcludeCategory(cat.id)}
                    className={cn(
                      "flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer select-none",
                      isExcluded
                        ? "bg-rose-50/70 dark:bg-rose-950/25 border-rose-200 dark:border-rose-900/60"
                        : "bg-white dark:bg-[#121215] border-[#E5E7EB] dark:border-[#27272A] hover:bg-[#F8F9FA] dark:hover:bg-[#1A1A20]",
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Checkbox */}
                      <div
                        className={cn(
                          "w-4 h-4 rounded-md flex items-center justify-center border transition-colors shrink-0",
                          isExcluded
                            ? "bg-[#E11D48] border-[#E11D48] text-white"
                            : "border-[#CBD5E1] dark:border-[#475569] bg-transparent",
                        )}
                      >
                        {isExcluded && <Check className="w-3 h-3 stroke-3" />}
                      </div>

                      {/* Icon */}
                      <div className="w-7 h-7 rounded-lg bg-[#F1F3F5] dark:bg-[#1A1A20] flex items-center justify-center shrink-0 border border-[#E5E7EB] dark:border-[#27272A]">
                        <DynamicIcon
                          name={
                            cat.category?.icon ||
                            (sheetCategoryType === "income"
                              ? "TrendingUp"
                              : "Tag")
                          }
                          className="w-3.5 h-3.5 text-[#0F172A] dark:text-[#FAFAFA]"
                        />
                      </div>

                      {/* Name & Count */}
                      <div className="flex flex-col min-w-0">
                        <span
                          className={cn(
                            "text-xs font-bold truncate",
                            isExcluded
                              ? "line-through text-[#64748B] dark:text-[#94A3B8]"
                              : "text-[#0F172A] dark:text-[#FAFAFA]",
                          )}
                        >
                          {cat.name}
                        </span>
                        <span className="text-[10px] text-[#94A3B8] font-mono">
                          {cat.count} {t.reports.transactionCount}
                        </span>
                      </div>
                    </div>

                    {/* Amount & Status Badge */}
                    <div className="flex flex-col items-end shrink-0 pl-2">
                      <span
                        className={cn(
                          "text-xs font-bold font-mono tnum",
                          isExcluded
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-[#0F172A] dark:text-[#FAFAFA]",
                        )}
                      >
                        {maskCurrency(
                          formatCurrency(cat.total, displayCurrency),
                          isPrivate,
                        )}
                      </span>
                      {isExcluded && (
                        <span className="text-[9px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
                          {t.reports.excluded}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Sticky Bottom Apply Button */}
          <div className="pt-2 mt-1 border-t border-[#E5E7EB] dark:border-[#27272A]">
            <Button
              type="button"
              onClick={() => {
                setIsExcludeSheetOpen(false);
                setCategorySearchQuery("");
              }}
              className="w-full py-2.5 rounded-xl font-bold text-xs bg-[#0F172A] dark:bg-[#FAFAFA] text-white dark:text-[#0F172A] cursor-pointer"
            >
              {t.reports.applyFilter.replace(
                "{count}",
                String(excludedCategoryIds.length),
              )}
            </Button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
