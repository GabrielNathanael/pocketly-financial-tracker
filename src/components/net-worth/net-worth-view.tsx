"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  formatCurrency,
  convertAmount,
} from "@/lib/utils/currency";
import type { NetWorthSnapshotPoint, NetWorthSummary } from "@/actions/exchange-rate";
import { usePreferredCurrency } from "@/lib/storage/preferred-currency";
import { usePrivacyMode, maskCurrency } from "@/lib/storage/privacy-mode";
import { useLanguage } from "@/lib/i18n/language-context";
import {
  ArrowLeft,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Target,
  Coins,
  Bitcoin,
  LineChart,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

interface NetWorthViewProps {
  data: NetWorthSummary;
  snapshots: NetWorthSnapshotPoint[];
}

type RangeKey = "1M" | "3M" | "6M" | "1Y" | "ALL";
const RANGE_DAYS: Record<RangeKey, number | null> = {
  "1M": 30,
  "3M": 90,
  "6M": 180,
  "1Y": 365,
  ALL: null,
};

export function NetWorthView({ data, snapshots }: NetWorthViewProps) {
  const { t, language } = useLanguage();
  const isPrivate = usePrivacyMode();
  const displayCurrency = usePreferredCurrency();
  const [selectedSlice, setSelectedSlice] = useState<string | null>(null);
  const [range, setRange] = useState<RangeKey>("3M");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const convert = (amountIdr: number, rates = data.rates) =>
    convertAmount(amountIdr, "IDR", displayCurrency, rates);

  const totalAccounts = convert(data.totalAccountsIdr);
  const totalStocks = convert(data.totalStockHoldingsIdr);
  const totalCrypto = convert(data.totalCryptoHoldingsIdr);
  const totalEtf = convert(data.totalEtfHoldingsIdr);
  const totalReceivables = convert(data.totalReceivablesIdr);
  const totalGoals = convert(data.totalSavingsGoalsIdr);
  const totalDebts = convert(data.totalDebtsIdr);
  const totalAssets =
    totalAccounts + totalStocks + totalCrypto + totalEtf + totalReceivables + totalGoals;
  const netWorth = totalAssets - totalDebts;

  const assetCategories = [
    {
      id: "accounts",
      name: t.netWorth.cashBank,
      total: totalAccounts,
      color: "#0EA5E9",
      href: "/accounts",
      icon: <Wallet className="w-3.5 h-3.5" />,
      items: data.accounts.map((a) => ({
        id: a.id,
        name: a.name,
        amount: convert(a.amountIdr),
      })),
    },
    {
      id: "stocks",
      name: t.netWorth.stocks,
      total: totalStocks,
      color: "#8B5CF6",
      href: "/investments",
      icon: <TrendingUp className="w-3.5 h-3.5" />,
      items: data.stocks.map((a) => ({
        id: a.id,
        name: a.name,
        amount: convert(a.amountIdr),
      })),
    },
    {
      id: "crypto",
      name: t.netWorth.crypto,
      total: totalCrypto,
      color: "#F59E0B",
      href: "/investments",
      icon: <Bitcoin className="w-3.5 h-3.5" />,
      items: data.crypto.map((a) => ({
        id: a.id,
        name: a.name,
        amount: convert(a.amountIdr),
      })),
    },
    {
      id: "etf",
      name: "ETF",
      total: totalEtf,
      color: "#EC4899",
      href: "/investments",
      icon: <LineChart className="w-3.5 h-3.5" />,
      items: data.etf.map((a) => ({
        id: a.id,
        name: a.name,
        amount: convert(a.amountIdr),
      })),
    },
    {
      id: "goals",
      name: t.netWorth.savingsGoals,
      total: totalGoals,
      color: "#14B8A6",
      href: "/goals",
      icon: <Target className="w-3.5 h-3.5" />,
      items: data.goals.map((a) => ({
        id: a.id,
        name: a.name,
        amount: convert(a.amountIdr),
      })),
    },
    {
      id: "receivables",
      name: t.netWorth.receivables,
      total: totalReceivables,
      color: "#22C55E",
      href: "/debts",
      icon: <ArrowUpRight className="w-3.5 h-3.5" />,
      items: data.receivables.map((a) => ({
        id: a.id,
        name: a.name,
        amount: convert(a.amountIdr),
      })),
    },
  ].map((c) => ({
    ...c,
    percentage: totalAssets > 0 ? (c.total / totalAssets) * 100 : 0,
  }));

  const activeCategory = assetCategories.find((c) => c.id === selectedSlice);

  // Full donut via arc paths (gap between slices, clean edges).
  const donut = useMemo(() => {
    const cx = 100;
    const cy = 100;
    const outerR = 84;
    const innerR = 62;
    const GAP = 2; // degrees between slices
    const visible = assetCategories.filter((c) => c.total > 0);
    if (visible.length === 0) return [];
    // Single slice: draw a full ring as two half arcs.
    if (visible.length === 1) {
      const c = visible[0];
      return [
        {
          ...c,
          path: `M ${cx} ${cy - outerR} A ${outerR} ${outerR} 0 1 1 ${cx} ${cy + outerR} A ${outerR} ${outerR} 0 1 1 ${cx} ${cy - outerR} L ${cx} ${cy - innerR} A ${innerR} ${innerR} 0 1 0 ${cx} ${cy + innerR} A ${innerR} ${innerR} 0 1 0 ${cx} ${cy - innerR} Z`,
        },
      ];
    }
    let cumulative = 0;
    return visible.map((c) => {
      const startPct = cumulative;
      cumulative += c.percentage;
      const endPct = cumulative;
      // Start at top (-90deg), sweep clockwise.
      const startDeg = -90 + (startPct / 100) * 360 + GAP / 2;
      const endDeg = -90 + (endPct / 100) * 360 - GAP / 2;
      const startRad = (startDeg * Math.PI) / 180;
      const endRad = (endDeg * Math.PI) / 180;
      const x1 = cx + outerR * Math.cos(startRad);
      const y1 = cy + outerR * Math.sin(startRad);
      const x2 = cx + outerR * Math.cos(endRad);
      const y2 = cy + outerR * Math.sin(endRad);
      const ix1 = cx + innerR * Math.cos(startRad);
      const iy1 = cy + innerR * Math.sin(startRad);
      const ix2 = cx + innerR * Math.cos(endRad);
      const iy2 = cy + innerR * Math.sin(endRad);
      const largeArc = endDeg - startDeg > 180 ? 1 : 0;
      return {
        ...c,
        path: `M ${x1} ${y1} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix1} ${iy1} Z`,
      };
    });
  }, [assetCategories]);

  const trendData = useMemo(() => {
    const days = RANGE_DAYS[range];
    const now = new Date();
    const cutoff = days ? new Date(now.getTime() - days * 86400000) : new Date(0);
    return snapshots
      .filter((s) => new Date(s.date) >= cutoff)
      .map((s) => {
        const netWorth = convertAmount(s.netWorthIdr, "IDR", displayCurrency, s.rates);
        const assets = convertAmount(s.assetsIdr, "IDR", displayCurrency, s.rates);
        return {
          date: s.date,
          netWorth,
          assets,
          liabilities: assets - netWorth,
        };
      });
  }, [snapshots, range, displayCurrency]);

  const firstTrend = trendData[0]?.netWorth;
  const lastTrend = trendData[trendData.length - 1]?.netWorth;
  const trendDelta =
    firstTrend !== undefined && lastTrend !== undefined && firstTrend !== 0
      ? ((lastTrend - firstTrend) / Math.abs(firstTrend)) * 100
      : null;

  const fmt = (v: number) =>
    maskCurrency(formatCurrency(v, displayCurrency), isPrivate);

  return (
    <div className="flex flex-col gap-4 max-w-4xl mx-auto">
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#FAFAFA]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t.netWorth.backToHome}</span>
        </Link>
      </div>

      {/* HERO — dark balance-sheet card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0F172A] to-[#1E293B] p-5 sm:p-8 text-white shadow-md">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-sky-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="relative flex flex-col gap-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300">
            {t.netWorth.netWorthLabel} ({displayCurrency})
          </span>
          <h1 className="font-mono text-4xl sm:text-5xl font-black tracking-tight tnum leading-none break-words">
            {fmt(netWorth)}
          </h1>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs">
            <span className="font-bold text-emerald-300">
              +{fmt(totalAssets)} {t.netWorth.assets}
            </span>
            <span className="text-slate-400">−</span>
            <span className="font-bold text-rose-300">
              {fmt(totalDebts)} {t.netWorth.debts}
            </span>
            {displayCurrency !== "IDR" && (
              <span className="text-slate-400 tnum">
                (≈ {maskCurrency(formatCurrency(data.netWorthIdr, "IDR"), isPrivate)})
              </span>
            )}
          </div>
          {trendDelta !== null && (
            <span
              className={cn(
                "inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold",
                trendDelta >= 0
                  ? "bg-emerald-400/15 text-emerald-300"
                  : "bg-rose-400/15 text-rose-300",
              )}
            >
              {trendDelta >= 0 ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <ArrowDownRight className="w-3 h-3" />
              )}
              {trendDelta >= 0 ? "+" : ""}
              {trendDelta.toFixed(2)}% ({range})
            </span>
          )}
          {data.latestPriceFetchedAt &&
            (data.stocks.length > 0 ||
              data.crypto.length > 0 ||
              data.etf.length > 0) && (
              <span className="text-[10px] text-slate-400">
                {language === "en" ? "Prices as of " : "Harga per "}
                {new Date(data.latestPriceFetchedAt).toLocaleString(
                  language === "en" ? "en-US" : "id-ID",
                  {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  },
                )}
              </span>
            )}
        </div>
      </div>

      {/* TREND CHART */}
      <div className="rounded-2xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] p-4 sm:p-5 flex flex-col gap-3 shadow-2xs">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#0F172A] dark:text-[#F8FAFC]">
            {t.netWorth.trendTitle}
          </h2>
          <div className="flex items-center gap-1">
            {(Object.keys(RANGE_DAYS) as RangeKey[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={cn(
                  "px-2 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer",
                  range === r
                    ? "bg-[#0F172A] text-white dark:bg-[#FAFAFA] dark:text-[#0F172A]"
                    : "text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#FAFAFA]",
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {trendData.length < 2 ? (
          <div className="flex flex-col items-center gap-1 py-8 text-center">
            <Coins className="w-6 h-6 text-[#94A3B8]" />
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8] max-w-xs">
              {t.netWorth.trendEmpty}
            </p>
            {trendData.length === 1 && (
              <span className="font-mono text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                {fmt(trendData[0].netWorth)}
              </span>
            )}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={trendData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="nwFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0EA5E9" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#0EA5E9" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "#94A3B8" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(d: string) =>
                  new Date(d).toLocaleDateString(language === "en" ? "en-US" : "id-ID", {
                    day: "numeric",
                    month: "short",
                  })
                }
              />
              <YAxis
                tick={{ fontSize: 9, fill: "#94A3B8" }}
                axisLine={false}
                tickLine={false}
                width={52}
                tickFormatter={(v: number) =>
                  isPrivate
                    ? "•••"
                    : formatCurrency(v, displayCurrency, { compact: true }).replace(/^(Rp|\$|S\$)\s?/, "")
                }
              />
              <Tooltip
                content={({ active, payload, label }: any) => {
                  if (!active || !payload?.length) return null;
                  const point = payload[0]?.payload as
                    | { netWorth?: number; assets?: number; liabilities?: number }
                    | undefined;
                  const netWorth = Number(point?.netWorth ?? 0);
                  const assets = Number(point?.assets ?? 0);
                  const liabilities = Number(point?.liabilities ?? 0);
                  return (
                    <div
                      style={{ fontSize: 11, borderRadius: 12 }}
                      className="border border-[#E5E7EB] bg-white px-2.5 py-2 shadow-lg dark:border-[#27272A] dark:bg-[#121215]"
                    >
                      <div className="mb-1 font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                        {new Date(String(label ?? "")).toLocaleDateString(
                          language === "en" ? "en-US" : "id-ID",
                          { day: "numeric", month: "long", year: "numeric" },
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-[#0EA5E9]">
                          {t.netWorth.assets}
                        </span>
                        <span className="font-mono font-bold text-[#0EA5E9] tnum">
                          {fmt(assets)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-[#E11D48]">
                          {t.netWorth.debts}
                        </span>
                        <span className="font-mono font-bold text-[#E11D48] tnum">
                          {fmt(liabilities)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-4 border-t border-[#E5E7EB] pt-1 dark:border-[#27272A]">
                        <span className="text-[#64748B] dark:text-[#94A3B8]">
                          {t.netWorth.netWorthLabel}
                        </span>
                        <span
                          className="font-mono font-bold tnum"
                          style={{ color: netWorth >= 0 ? "#0D9488" : "#E11D48" }}
                        >
                          {fmt(netWorth)}
                        </span>
                      </div>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="netWorth"
                stroke="#0EA5E9"
                strokeWidth={2}
                fill="url(#nwFill)"
                dot={trendData.length <= 10}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ALLOCATION — donut + legend/bars */}
      <div className="rounded-2xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] p-4 sm:p-5 shadow-2xs">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#0F172A] dark:text-[#F8FAFC] pb-3">
          {t.netWorth.allocationTitle}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-[220px_1fr] gap-5 items-center">
          <div className="relative mx-auto h-[200px] w-[200px] shrink-0">
            <svg width="200" height="200" viewBox="0 0 200 200" className="select-none">
              <circle cx="100" cy="100" r="73" fill="none" stroke="#F1F3F5" strokeWidth="22" className="dark:stroke-[#1E1E24]" />
              {donut.map((seg) => (
                <path
                  key={seg.id}
                  d={seg.path}
                  fill={seg.color}
                  onClick={() => setSelectedSlice(selectedSlice === seg.id ? null : seg.id)}
                  className={cn(
                    "cursor-pointer transition-opacity",
                    selectedSlice && selectedSlice !== seg.id && "opacity-25",
                  )}
                />
              ))}
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center px-8">
              <span className="max-w-full truncate text-[9px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
                {activeCategory ? activeCategory.name : t.netWorth.totalAssets}
              </span>
              <span className="mt-0.5 max-w-full truncate font-mono text-sm font-black text-[#0F172A] dark:text-[#F8FAFC] tnum">
                {(() => {
                  const v = activeCategory ? activeCategory.total : totalAssets;
                  const full = fmt(v);
                  // Compact form fits inside the donut hole for long amounts.
                  return full.length > 14
                    ? maskCurrency(
                        formatCurrency(v, displayCurrency, { compact: true }),
                        isPrivate,
                      )
                    : full;
                })()}
              </span>
              <span className="font-mono text-xs font-bold text-amber-500">
                {activeCategory ? `${activeCategory.percentage.toFixed(1)}%` : "100%"}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {assetCategories.filter((c) => c.total > 0).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedSlice(selectedSlice === c.id ? null : c.id)}
                className={cn(
                  "flex flex-col gap-1 rounded-xl border p-2.5 text-left transition-all cursor-pointer",
                  selectedSlice === c.id
                    ? "border-[#0F172A] dark:border-[#FAFAFA] bg-[#F8F9FA] dark:bg-[#1A1A20]"
                    : "border-[#E5E7EB] dark:border-[#27272A] hover:border-[#CBD5E1]",
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                    {c.name}
                  </span>
                  <span className="font-mono text-xs font-bold tnum">
                    {fmt(c.total)} <span className="text-[#94A3B8] font-semibold">{c.percentage.toFixed(1)}%</span>
                  </span>
                </span>
                <span className="h-1.5 w-full overflow-hidden rounded-full bg-[#F1F3F5] dark:bg-[#1E1E24]">
                  <span
                    className="block h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, c.percentage)}%`, backgroundColor: c.color }}
                  />
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* BREAKDOWN 2-col */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] p-4 sm:p-5 flex flex-col gap-3 shadow-2xs">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#0F172A] dark:text-[#F8FAFC]">
            {t.netWorth.assets} — {fmt(totalAssets)}
          </h2>
          {assetCategories.map((c) => {
            const isExpanded = expanded.has(c.id);
            return (
            <div key={c.id} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <Link href={c.href} className="flex items-center gap-2 group min-w-0">
                  <span className="flex items-center gap-2 text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] group-hover:underline truncate">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg shrink-0" style={{ backgroundColor: `${c.color}1A`, color: c.color }}>
                      {c.icon}
                    </span>
                    <span className="truncate">{c.name}</span>
                  </span>
                </Link>
                <span className="flex items-center gap-1 shrink-0">
                  <span className="font-mono text-xs font-bold tnum">{fmt(c.total)}</span>
                  {c.items.length > 0 && (
                    <button
                      type="button"
                      onClick={() => toggleExpanded(c.id)}
                      aria-expanded={isExpanded}
                      aria-label={isExpanded ? "Collapse" : "Expand"}
                      className="rounded-md p-1 text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#FAFAFA] transition-colors cursor-pointer"
                    >
                      <ChevronDown className={cn("w-4 h-4 transition-transform", isExpanded && "rotate-180")} />
                    </button>
                  )}
                </span>
              </div>
              {isExpanded && c.items.length > 0 && (
                <div className="flex flex-col gap-0.5 pl-8 pr-0.5">
                  {c.items.map((it) => (
                    <div key={it.id} className="flex items-center justify-between gap-2 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                      <span className="truncate">{it.name}</span>
                      <span className="font-mono shrink-0 tnum">{fmt(it.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            );
          })}
        </div>

        <div className="rounded-2xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] p-4 sm:p-5 flex flex-col gap-3 shadow-2xs">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#0F172A] dark:text-[#F8FAFC]">
            {t.netWorth.liabilitiesTitle} — {fmt(totalDebts)}
          </h2>
          {data.debts.length === 0 ? (
            <p className="text-xs text-[#94A3B8] py-4 text-center">
              {t.netWorth.noActiveDebts}
            </p>
          ) : (
            data.debts.map((d) => (
              <Link key={d.id} href="/debts" className="flex items-center justify-between gap-2 group">
                <span className="flex items-center gap-2 text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] group-hover:underline">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-rose-500/10 text-rose-500">
                    <ArrowDownRight className="w-3.5 h-3.5" />
                  </span>
                  {d.name}
                </span>
                <span className="font-mono text-xs font-bold text-rose-500 tnum">
                  -{fmt(convert(d.amountIdr))}
                </span>
              </Link>
            ))
          )}
        </div>
      </div>

    </div>
  );
}
