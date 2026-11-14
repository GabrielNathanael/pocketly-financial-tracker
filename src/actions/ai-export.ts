"use server";

import JSZip from "jszip";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { convertAmount, type ForexRatesMap, DEFAULT_FALLBACK_RATES } from "@/lib/utils/currency";
import { getLatestForexRates } from "@/actions/exchange-rate";
import { getCleanDescription } from "@/lib/utils/description";
import { normalizeStoredItems, formatItemsSummary } from "@/lib/utils/transaction-items";
import { formatCategoryName } from "@/lib/utils/category-i18n";
import { getUserTimeZone } from "@/lib/utils/timezone-server";
import {
  getLocalDateRangeBoundsUTC,
  getEndDateStringForPeriod,
  getZonedDateString,
  getCurrentMonthDateStrings,
} from "@/lib/utils/date";
import { getDebts } from "@/actions/debts";
import { getSavingsGoals } from "@/actions/goals";
import type { CurrencyCode } from "@/types/database";

export type AiExportPreset = "all" | "thisMonth" | "lastMonth" | "thisYear" | "custom";

export interface AiExportOptions {
  preset: AiExportPreset;
  /** Backward-compat: explicit UTC/ISO bounds, half-open [rangeStart, rangeEnd). Prefer customStartDate/customEndDate for custom. */
  rangeStart?: string;
  /** Backward-compat: exclusive end bound ISO. */
  rangeEnd?: string;
  /** Custom inclusive start date in user-local calendar intent (YYYY-MM-DD). */
  customStartDate?: string;
  /** Custom inclusive end date in user-local calendar intent (YYYY-MM-DD). */
  customEndDate?: string;
  baseCurrency: CurrencyCode;
  language: "id" | "en";
  includeTransactionsCsv: boolean;
  includeTransfersCsv: boolean;
  includeContextJson: boolean;
  /** When true, produce a more compact/token-efficient summary (less verbose snapshots/breakdowns). */
  compactMode?: boolean;
  metrics: {
    comparePrevious: boolean;
    averagesMedian: boolean;
    noSpendDays: boolean;
    volatility: boolean;
    trend: boolean;
    breakdowns: boolean;
    topTransactions: boolean;
    highlights: boolean;
  };
}

export interface AiExportResult {
  filename: string;
  mime: "text/markdown" | "application/zip";
  /** utf-8 string for single .md, or base64 for .zip */
  content: string;
  encoding: "utf-8" | "base64";
}

interface TxRow {
  id: string;
  date: string;
  date_local: string;
  type: "income" | "expense";
  amount_original: number;
  currency_original: string;
  amount_normalized: number;
  base_currency: string;
  account_name: string;
  account_currency: string;
  category_key: string;
  category_name: string;
  category_name_display: string;
  description_raw: string;
  description_clean: string;
  tags: string[];
  items_json: string;
  items_summary: string;
  transfer_id_ref: string | null;
  related_trade_ref: string | null;
  created_at: string;
  account_id: string;
  category_id: string | null;
}

interface TransferRow {
  id: string;
  date: string;
  date_local: string;
  from_account: string;
  to_account: string;
  amount_original: number;
  from_currency: string;
  to_currency: string;
  amount_normalized_from: number;
  base_currency: string;
  exchange_rate: number | null;
  fee_amount: number | null;
  fee_currency: string;
  fee_mode: string | null;
  net_amount: number | null;
  fee_normalized_base: number | null;
  description: string;
}

function parseBound(value?: string): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error("Invalid date range");
  return d.toISOString();
}

function isYmd(s?: string): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function csvCell(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? "" : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
function sum(nums: number[]) {
  return nums.reduce((a, b) => a + b, 0);
}
function pctValue(part: number, total: number): number | null {
  if (!total) return null;
  return round2((part / total) * 100);
}
function fmtNum(n: number, lang: "id" | "en") {
  return new Intl.NumberFormat(lang === "id" ? "id-ID" : "en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}
function fmtMaybeNum(n: number | null | undefined, lang: "id" | "en") {
  return n === null || n === undefined || Number.isNaN(n) ? "n/a" : fmtNum(n, lang);
}
function fmtMoney(n: number, cur: string, lang: "id" | "en") {
  return `${cur} ${fmtNum(n, lang)}`;
}
function dateKeyFromIsoLocal(iso: string, tz: string) {
  return getZonedDateString(new Date(iso), tz);
}
function diffDaysBounds(startIso: string, endIsoExclusive: string) {
  const a = new Date(startIso).getTime();
  const b = new Date(endIsoExclusive).getTime();
  return Math.max(1, Math.round((b - a) / 86400000));
}
function addMonthsYmd(periodStart: string, months: number): string {
  const [y, m] = periodStart.split("-").map(Number);
  const idx = y * 12 + (m - 1) + months;
  const ny = Math.floor(idx / 12);
  const nm = (idx % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}-01`;
}
function localDateSpanDays(startYmd: string, endYmdInclusive: string): number {
  const [y1, m1, d1] = startYmd.split("-").map(Number);
  const [y2, m2, d2] = endYmdInclusive.split("-").map(Number);
  const a = Date.UTC(y1, m1 - 1, d1);
  const b = Date.UTC(y2, m2 - 1, d2);
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}
function previousCalendarBounds(
  startDateLocal: string | null,
  endDateLocal: string | null,
  rangeStart: string | null,
  rangeEnd: string | null,
  timeZone: string,
) {
  if (!rangeStart || !rangeEnd) return null;
  if (startDateLocal && endDateLocal) {
    const isMonthAligned = startDateLocal.endsWith("-01") && endDateLocal === getEndDateStringForPeriod(startDateLocal);
    if (isMonthAligned) {
      const [y, m] = startDateLocal.split("-").map(Number);
      const startIdx = y * 12 + (m - 1);
      const [ey, em] = endDateLocal.slice(0, 7).split("-").map(Number);
      const endIdx = ey * 12 + (em - 1);
      const monthSpan = endIdx - startIdx + 1;
      const prevStart = addMonthsYmd(startDateLocal, -monthSpan);
      const prevEndMonth = addMonthsYmd(startDateLocal, -1);
      const prevEnd = getEndDateStringForPeriod(prevEndMonth);
      const b = getLocalDateRangeBoundsUTC(prevStart, prevEnd, timeZone);
      return { start: b.startUtc, end: b.endUtcExclusive, startDateLocal: prevStart, endDateLocal: prevEnd };
    }
    const span = localDateSpanDays(startDateLocal, endDateLocal);
    const [y1, m1, d1] = startDateLocal.split("-").map(Number);
    const prevEndDate = new Date(Date.UTC(y1, m1 - 1, d1 - 1));
    const prevStartDate = new Date(Date.UTC(y1, m1 - 1, d1 - span));
    const prevStartY = prevStartDate.toISOString().slice(0, 10);
    const prevEndY = prevEndDate.toISOString().slice(0, 10);
    const b = getLocalDateRangeBoundsUTC(prevStartY, prevEndY, timeZone);
    return { start: b.startUtc, end: b.endUtcExclusive, startDateLocal: prevStartY, endDateLocal: prevEndY };
  }
  const a = new Date(rangeStart).getTime();
  const b = new Date(rangeEnd).getTime();
  const len = b - a;
  if (!(len > 0)) return null;
  return { start: new Date(a - len).toISOString(), end: new Date(a).toISOString(), startDateLocal: null, endDateLocal: null };
}
function computeLedgerMetrics(rows: Pick<TxRow, "type" | "amount_normalized" | "category_id">[], baseCurrency: string) {
  const incomes = rows.filter((r) => r.type === "income");
  const expenses = rows.filter((r) => r.type === "expense");
  const income = round2(sum(incomes.map((r) => r.amount_normalized)));
  const expense = round2(sum(expenses.map((r) => r.amount_normalized)));
  const net = round2(income - expense);
  return {
    base_currency: baseCurrency,
    income_normalized: income,
    expense_normalized: expense,
    net_cashflow_normalized: net,
    tx_count_ledger: rows.length,
    income_count: incomes.length,
    expense_count: expenses.length,
    uncategorized_count: rows.filter((r) => !r.category_id).length,
  };
}
function topN<T>(arr: T[], n: number, score: (x: T) => number) {
  return [...arr].sort((a, b) => score(b) - score(a)).slice(0, n);
}
function metricWithMeta<T>(value: T, available: boolean, reason: string | null = null) {
  return { value, available, reason };
}
function cmpPct(delta: number, base: number) {
  if (base === 0) return metricWithMeta<number | null>(null, false, "baseline_zero");
  return metricWithMeta<number | null>(round2((delta / base) * 100), true, null);
}
function localDayKeysBetween(startYmd: string, endYmdInclusive: string): string[] {
  const out: string[] = [];
  const [y1, m1, d1] = startYmd.split("-").map(Number);
  const [y2, m2, d2] = endYmdInclusive.split("-").map(Number);
  let cur = Date.UTC(y1, m1 - 1, d1);
  const end = Date.UTC(y2, m2 - 1, d2);
  while (cur <= end) {
    out.push(new Date(cur).toISOString().slice(0, 10));
    cur += 86400000;
  }
  return out;
}

export async function exportAiCashflowData(
  options: AiExportOptions,
): Promise<AiExportResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const baseCurrency = options.baseCurrency || "IDR";
  const lang = options.language || "id";
  const compact = !!options.compactMode;
  const timeZone = await getUserTimeZone();

  // Resolve period bounds in user-local calendar intent, half-open [rangeStart, rangeEnd)
  let rangeStart: string | null = null;
  let rangeEnd: string | null = null;
  let periodStartDateLocal: string | null = null;
  let periodEndDateLocal: string | null = null; // inclusive calendar end
  let periodResolution = "";

  if (options.preset === "all") {
    rangeStart = null;
    rangeEnd = null;
    periodStartDateLocal = null;
    periodEndDateLocal = null;
    periodResolution = "all_available_records";
  } else if (options.preset === "custom") {
    if (isYmd(options.customStartDate) && isYmd(options.customEndDate)) {
      if (options.customStartDate > options.customEndDate) throw new Error("Invalid date range");
      periodStartDateLocal = options.customStartDate;
      periodEndDateLocal = options.customEndDate;
      const b = getLocalDateRangeBoundsUTC(periodStartDateLocal, periodEndDateLocal, timeZone);
      rangeStart = b.startUtc;
      rangeEnd = b.endUtcExclusive;
      periodResolution = "custom_local_calendar_dates_via_user_timezone";
    } else {
      // backward-compat ISO bounds
      rangeStart = parseBound(options.rangeStart) || null;
      rangeEnd = parseBound(options.rangeEnd) || null;
      if (rangeStart && rangeEnd) {
        if (rangeStart >= rangeEnd) throw new Error("Invalid date range");
        periodStartDateLocal = getZonedDateString(new Date(rangeStart), timeZone);
        // exclusive end -> inclusive end local
        const endMinus1 = new Date(new Date(rangeEnd).getTime() - 1);
        periodEndDateLocal = getZonedDateString(endMinus1, timeZone);
        periodResolution = "custom_iso_bounds_interpreted_as_instants";
      } else {
        throw new Error("Invalid date range");
      }
    }
  } else {
    // presets computed from 'today' in user timezone
    const { startDate: thisMonthStart, endDate: thisMonthEnd } = getCurrentMonthDateStrings(timeZone);
    if (options.preset === "thisMonth") {
      periodStartDateLocal = thisMonthStart;
      periodEndDateLocal = thisMonthEnd;
    } else if (options.preset === "lastMonth") {
      periodStartDateLocal = addMonthsYmd(thisMonthStart, -1);
      periodEndDateLocal = getEndDateStringForPeriod(periodStartDateLocal);
    } else if (options.preset === "thisYear") {
      const year = thisMonthStart.slice(0, 4);
      periodStartDateLocal = `${year}-01-01`;
      periodEndDateLocal = `${year}-12-31`;
    }
    if (periodStartDateLocal && periodEndDateLocal) {
      const b = getLocalDateRangeBoundsUTC(periodStartDateLocal, periodEndDateLocal, timeZone);
      rangeStart = b.startUtc;
      rangeEnd = b.endUtcExclusive;
      periodResolution = "preset_computed_from_user_timezone_today";
    }
  }

  // FX rates (USD-base map) + structured meta
  let rates: ForexRatesMap = { ...DEFAULT_FALLBACK_RATES };
  let fxSource = "fallback_default";
  let fxFetchedAt: string | null = null;
  let fxNote = "default fallback USD-base rates (latest fetch unavailable)";
  try {
    const supabaseFx = supabase;
    const { data: fxRows } = await supabaseFx
      .from("exchange_rates")
      .select("target_currency, rate, fetched_at")
      .eq("base_currency", "USD")
      .order("fetched_at", { ascending: false })
      .limit(50);
    const seen = new Set<string>();
    let latest: string | null = null;
    for (const r of fxRows || []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const row = r as any;
      if (!row.target_currency || !row.rate || seen.has(row.target_currency)) continue;
      seen.add(row.target_currency);
      rates[row.target_currency] = Number(row.rate);
      if (!latest && row.fetched_at) latest = row.fetched_at;
    }
    if (seen.size > 0) {
      fxSource = "latest_stored_exchange_rates";
      fxFetchedAt = latest;
      fxNote = "latest stored exchange rates (USD base)";
    } else {
      // try action fallback
      try {
        rates = await getLatestForexRates();
        fxSource = "latest_stored_exchange_rates_action";
        fxNote = "latest stored exchange rates (USD base)";
        try {
          const { data: tsRows } = await supabaseFx.from("exchange_rates").select("fetched_at").eq("base_currency", "USD").order("fetched_at", { ascending: false }).limit(1);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          fxFetchedAt = (tsRows as any)?.[0]?.fetched_at || null;
        } catch { /* ignore */ }
      } catch { /* keep default */ }
    }
  } catch {
    try {
      rates = await getLatestForexRates();
      fxSource = "latest_stored_exchange_rates_action";
      fxNote = "latest stored exchange rates (USD base)";
      try {
        const { data: tsRows } = await supabase.from("exchange_rates").select("fetched_at").eq("base_currency", "USD").order("fetched_at", { ascending: false }).limit(1);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        fxFetchedAt = (tsRows as any)?.[0]?.fetched_at || null;
      } catch { /* ignore */ }
    } catch {
      rates = { ...DEFAULT_FALLBACK_RATES };
      fxSource = "fallback_default";
      fxNote = "default fallback USD-base rates (failed to load latest)";
    }
  }

  // 1) Raw ledger transactions in period
  let txQuery = supabase
    .from("transactions")
    .select(
      "id, transaction_date, type, amount, currency, description, tags, items, created_at, account_id, category_id, transfer_id, crypto_trade_id, stock_trade_id, etf_trade_id, account:accounts(name,currency), category:categories(name,type)",
    )
    .order("transaction_date", { ascending: true });
  if (rangeStart) txQuery = txQuery.gte("transaction_date", rangeStart);
  if (rangeEnd) txQuery = txQuery.lt("transaction_date", rangeEnd);

  // 2) Transfers in period (separate flow)
  let trQuery = supabase
    .from("transfers")
    .select(
      "id, transfer_date, from_account_id, to_account_id, amount, from_currency, to_currency, exchange_rate_used, fee_amount, fee_mode, net_amount, description, from_account:accounts!transfers_from_account_id_fkey(name), to_account:accounts!transfers_to_account_id_fkey(name)",
    )
    .order("transfer_date", { ascending: true });
  if (rangeStart) trQuery = trQuery.gte("transfer_date", rangeStart);
  if (rangeEnd) trQuery = trQuery.lt("transfer_date", rangeEnd);

  // 3) Accounts snapshot (all)
  const accountsQuery = supabase
    .from("accounts")
    .select("id,name,type,currency,current_balance,initial_balance,is_active,is_default")
    .order("created_at", { ascending: true });

  const [txRes, trRes, accRes] = await Promise.all([txQuery, trQuery, accountsQuery]);
  if (txRes.error) throw new Error(`Export failed: ${txRes.error.message}`);
  if (trRes.error) throw new Error(`Export failed: ${trRes.error.message}`);
  if (accRes.error) throw new Error(`Export failed: ${accRes.error.message}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawTx = (txRes.data || []) as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawTr = (trRes.data || []) as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const accountsSnap = (accRes.data || []) as any[];

  const uncatLabel = lang === "id" ? "Tanpa Kategori" : "Uncategorized";
  const txRows: TxRow[] = rawTx.map((t) => {
    const currencyOriginal = t.currency || t.account?.currency || "IDR";
    const amountOriginal = Number(t.amount) || 0;
    const amount_normalized = round2(convertAmount(amountOriginal, currencyOriginal, baseCurrency, rates));
    const categoryName = t.category?.name || "";
    const items = normalizeStoredItems(t.items) || [];
    const tradeRef = t.stock_trade_id
      ? `stock:${t.stock_trade_id}`
      : t.crypto_trade_id
        ? `crypto:${t.crypto_trade_id}`
        : t.etf_trade_id
          ? `etf:${t.etf_trade_id}`
          : null;
    return {
      id: t.id,
      date: t.transaction_date,
      date_local: dateKeyFromIsoLocal(t.transaction_date, timeZone),
      type: t.type,
      amount_original: amountOriginal,
      currency_original: currencyOriginal,
      amount_normalized,
      base_currency: baseCurrency,
      account_name: t.account?.name || "",
      account_currency: t.account?.currency || currencyOriginal,
      category_key: categoryName || "__uncategorized__",
      category_name: categoryName,
      category_name_display: categoryName ? formatCategoryName(categoryName, lang) : uncatLabel,
      description_raw: t.description || "",
      description_clean: getCleanDescription(t.description) || "",
      tags: Array.isArray(t.tags) ? t.tags : [],
      items_json: items.length ? JSON.stringify(items) : "",
      items_summary: items.length ? formatItemsSummary(items, currencyOriginal) : "",
      transfer_id_ref: t.transfer_id || null,
      related_trade_ref: tradeRef,
      created_at: t.created_at || "",
      account_id: t.account_id || "",
      category_id: t.category_id || null,
    };
  });

  const trRows: TransferRow[] = rawTr.map((tr) => {
    const amountOriginal = Number(tr.amount) || 0;
    const fromCurrency = tr.from_currency || "IDR";
    const feeAmount = tr.fee_amount != null ? Number(tr.fee_amount) : null;
    const amount_normalized_from = round2(convertAmount(amountOriginal, fromCurrency, baseCurrency, rates));
    const fee_normalized_base = feeAmount != null ? round2(convertAmount(feeAmount, fromCurrency, baseCurrency, rates)) : null;
    return {
      id: tr.id,
      date: tr.transfer_date,
      date_local: dateKeyFromIsoLocal(tr.transfer_date, timeZone),
      from_account: tr.from_account?.name || "",
      to_account: tr.to_account?.name || "",
      amount_original: amountOriginal,
      from_currency: fromCurrency,
      to_currency: tr.to_currency || "",
      amount_normalized_from,
      base_currency: baseCurrency,
      exchange_rate: tr.exchange_rate_used ?? null,
      fee_amount: feeAmount,
      fee_currency: fromCurrency,
      fee_mode: tr.fee_mode ?? null,
      net_amount: tr.net_amount ?? null,
      fee_normalized_base,
      description: tr.description || "",
    };
  });

  // Actual data range (local dates) from returned records
  const allDatesLocal = [...txRows.map((r) => r.date_local), ...trRows.map((r) => r.date_local)].sort();
  const actualDataRange = {
    start_local: allDatesLocal[0] || null,
    end_local: allDatesLocal[allDatesLocal.length - 1] || null,
    has_data: allDatesLocal.length > 0,
  };

  // Context snapshots (best-effort)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let debtsSnap: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let goalsSnap: any[] = [];
  try {
    const [d, g] = await Promise.all([getDebts("all", "active"), getSavingsGoals()]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    debtsSnap = (d || []).map((x: any) => ({
      id: x.id,
      name: x.counterparty_name,
      type: x.type,
      status: x.status,
      total_native: Number(x.initial_amount) || 0,
      remaining_native: Number(x.remaining_amount) || 0,
      currency: x.currency,
      due_date: x.due_date,
      note: "native_currency_not_normalized_to_base",
    }));
    goalsSnap = (g || [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((x: any) => x.status === "in_progress" || x.status === "active" || x.status === "paused")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((x: any) => ({
        id: x.id,
        name: x.name,
        status: x.status,
        target_native: Number(x.target_amount) || 0,
        current_native: Number(x.current_amount) || 0,
        currency: x.currency,
        target_date: x.target_date,
        note: "native_currency_not_normalized_to_base",
      }));
  } catch {
    debtsSnap = []; goalsSnap = [];
  }

  // Budget snapshot (best-effort representative month) with explicit caveats
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let budgetsSnap: any[] = [];
  let budgetCaveat = null as null | Record<string, unknown>;
  try {
    const refMonthStart = periodStartDateLocal
      ? `${periodStartDateLocal.slice(0, 7)}-01`
      : getCurrentMonthDateStrings(timeZone).startDate;
    const periodEndForBudget = getEndDateStringForPeriod(refMonthStart);
    const { data: bRows } = await supabase
      .from("budgets")
      .select("id, category_id, amount, currency, period_start_date, category:categories(name,type)")
      .eq("period_start_date", refMonthStart);
    const { startUtc: bStart, endUtcExclusive: bEnd } = getLocalDateRangeBoundsUTC(refMonthStart, periodEndForBudget, timeZone);
    const { data: bTx } = await supabase
      .from("transactions")
      .select("amount,currency,category_id,type")
      .eq("type", "expense")
      .gte("transaction_date", bStart)
      .lt("transaction_date", bEnd);
    const spentMap = new Map<string, number>();
    for (const t of bTx || []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const row = t as any;
      const k = `${row.category_id}:${row.currency || ""}`;
      spentMap.set(k, (spentMap.get(k) || 0) + (Number(row.amount) || 0));
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    budgetsSnap = (bRows || []).map((b: any) => {
      const k = `${b.category_id}:${b.currency}`;
      const spent = round2(spentMap.get(k) || 0);
      const limit = Number(b.amount) || 0;
      return {
        category_key: b.category?.name || b.category_id,
        category: b.category?.name ? formatCategoryName(b.category.name, lang) : b.category_id,
        period_start: b.period_start_date,
        limit_native: limit,
        spent_native: spent,
        remaining_native: round2(limit - spent),
        currency: b.currency,
        alignment: "representative_month_snapshot",
      };
    });
    budgetCaveat = {
      type: "representative_non_period_aligned_approximation",
      representative_month_start: refMonthStart,
      representative_month_end: periodEndForBudget,
      computed_in_timezone: timeZone,
      aggregation: "spent grouped by category_id+currency in original currency (not normalized to base)",
      notes: [
        "Budget snapshot may not match the export period; for 'all' or multi-month/custom ranges it is month-representative only.",
        "No carryover applied; not part of ledger net_cashflow; amounts are native currency units and not directly summable with normalized ledger KPIs.",
      ],
    };
  } catch {
    budgetsSnap = [];
    budgetCaveat = { type: "unavailable", reason: "budget_snapshot_failed" };
  }

  // Metrics (ledger only, normalized to base)
  const ledger = computeLedgerMetrics(txRows, baseCurrency);
  const hasBoundedPeriod = !!(rangeStart && rangeEnd);
  const daysInPeriodCalendar = hasBoundedPeriod && periodStartDateLocal && periodEndDateLocal
    ? localDateSpanDays(periodStartDateLocal, periodEndDateLocal)
    : (hasBoundedPeriod ? diffDaysBounds(rangeStart!, rangeEnd!) : null);
  const daysInPeriod = daysInPeriodCalendar;
  const perDayDenom = daysInPeriod && daysInPeriod > 0 ? daysInPeriod : null;

  const incomeVals = txRows.filter((r) => r.type === "income").map((r) => r.amount_normalized);
  const expenseVals = txRows.filter((r) => r.type === "expense").map((r) => r.amount_normalized);

  const perDayMetrics = perDayDenom ? {
    per_day_net_normalized: metricWithMeta(round2(ledger.net_cashflow_normalized / perDayDenom), true, null),
    per_day_expense_normalized: metricWithMeta(round2(ledger.expense_normalized / perDayDenom), true, null),
    denominator_days: perDayDenom,
    basis: "bounded_calendar_period_days_in_user_timezone",
  } : {
    per_day_net_normalized: metricWithMeta<number | null>(null, false, options.preset === "all" ? "unbounded_period_all" : "no_bounded_period"),
    per_day_expense_normalized: metricWithMeta<number | null>(null, false, options.preset === "all" ? "unbounded_period_all" : "no_bounded_period"),
    denominator_days: null,
    basis: "unavailable",
  };

  // Previous period comparison
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prevMetrics: any = null;
  if (options.metrics.comparePrevious) {
    const prev = previousCalendarBounds(periodStartDateLocal, periodEndDateLocal, rangeStart, rangeEnd, timeZone);
    if (prev) {
      const { data: pRows } = await supabase
        .from("transactions")
        .select("id,type,amount,currency,category_id,account:accounts(currency)")
        .gte("transaction_date", prev.start)
        .lt("transaction_date", prev.end);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pNorm = (pRows || []).map((t: any) => {
        const c = t.currency || t.account?.currency || "IDR";
        return {
          type: t.type,
          amount_normalized: round2(convertAmount(Number(t.amount) || 0, c, baseCurrency, rates)),
          category_id: t.category_id || null,
        };
      });
      const p = computeLedgerMetrics(pNorm, baseCurrency);
      const incomeDelta = round2(ledger.income_normalized - p.income_normalized);
      const expenseDelta = round2(ledger.expense_normalized - p.expense_normalized);
      prevMetrics = {
        available: true,
        period: { start_utc: prev.start, end_utc_exclusive: prev.end, start_local: prev.startDateLocal, end_local: prev.endDateLocal },
        ledger: p,
        income_delta_normalized: incomeDelta,
        income_pct_change: cmpPct(incomeDelta, p.income_normalized),
        expense_delta_normalized: expenseDelta,
        expense_pct_change: cmpPct(expenseDelta, p.expense_normalized),
        net_delta_normalized: round2(ledger.net_cashflow_normalized - p.net_cashflow_normalized),
      };
    } else {
      prevMetrics = {
        available: false,
        reason: options.preset === "all" ? "comparison_not_applicable_for_all_period" : "previous_period_unavailable",
      };
    }
  }

  // Trend
  let trendGranularity: "daily_local" | "monthly_local" | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let trend: any[] = [];
  if (options.metrics.trend) {
    const useMonth = hasBoundedPeriod && daysInPeriod != null ? daysInPeriod > 120 : false;
    trendGranularity = useMonth ? "monthly_local" : "daily_local";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const by: Record<string, any> = {};
    for (const r of txRows) {
      const k = useMonth ? r.date_local.slice(0, 7) : r.date_local;
      if (!by[k]) by[k] = { bucket: k, income_normalized: 0, expense_normalized: 0, net_cashflow_normalized: 0, tx_count_ledger: 0 };
      if (r.type === "income") by[k].income_normalized += r.amount_normalized; else by[k].expense_normalized += r.amount_normalized;
      by[k].net_cashflow_normalized = by[k].income_normalized - by[k].expense_normalized;
      by[k].tx_count_ledger += 1;
    }
    trend = Object.values(by).sort((a, b) => String(a.bucket).localeCompare(String(b.bucket))).map((x) => ({
      ...x,
      income_normalized: round2(x.income_normalized),
      expense_normalized: round2(x.expense_normalized),
      net_cashflow_normalized: round2(x.net_cashflow_normalized),
    }));
  }

  // Breakdowns
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let byCategory: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let byAccount: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let byOriginalCurrency: any[] = [];
  if (options.metrics.breakdowns || true) { // totals by original currency always useful
    const totalsOrig = new Map<string, { currency_original: string; income_original: number; expense_original: number; income_normalized: number; expense_normalized: number; tx_count: number }>();
    for (const r of txRows) {
      if (!totalsOrig.has(r.currency_original)) totalsOrig.set(r.currency_original, { currency_original: r.currency_original, income_original: 0, expense_original: 0, income_normalized: 0, expense_normalized: 0, tx_count: 0 });
      const o = totalsOrig.get(r.currency_original)!;
      if (r.type === "income") { o.income_original += r.amount_original; o.income_normalized += r.amount_normalized; }
      else { o.expense_original += r.amount_original; o.expense_normalized += r.amount_normalized; }
      o.tx_count += 1;
    }
    byOriginalCurrency = Array.from(totalsOrig.values()).map((o) => ({
      ...o,
      income_original: round2(o.income_original), expense_original: round2(o.expense_original),
      income_normalized: round2(o.income_normalized), expense_normalized: round2(o.expense_normalized),
      net_normalized: round2(o.income_normalized - o.expense_normalized),
    })).sort((a, b) => Math.abs(b.net_normalized) - Math.abs(a.net_normalized));

    if (options.metrics.breakdowns) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const catMap = new Map<string, any>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const accMap = new Map<string, any>();
      for (const r of txRows) {
        const ck = `${r.type}:${r.category_key}`;
        if (!catMap.has(ck)) catMap.set(ck, { category_key: r.category_key, category: r.category_name_display, type: r.type, amount_normalized: 0, tx_count: 0 });
        const c = catMap.get(ck);
        c.amount_normalized += r.amount_normalized; c.tx_count += 1;
        const ak = `${r.account_name}|${r.account_currency}`;
        if (!accMap.has(ak)) accMap.set(ak, { account: r.account_name, account_currency: r.account_currency, income_normalized: 0, expense_normalized: 0, net_normalized: 0, tx_count: 0 });
        const a = accMap.get(ak);
        if (r.type === "income") a.income_normalized += r.amount_normalized; else a.expense_normalized += r.amount_normalized;
        a.net_normalized = a.income_normalized - a.expense_normalized; a.tx_count += 1;
      }
      const catRows = Array.from(catMap.values()).map((c) => {
        const denom = c.type === "income" ? ledger.income_normalized : ledger.expense_normalized;
        return { ...c, amount_normalized: round2(c.amount_normalized), share_pct_of_type: pctValue(c.amount_normalized, denom), avg_tx_normalized: round2(c.tx_count ? c.amount_normalized / c.tx_count : 0) };
      });
      byCategory = [...catRows].sort((a, b) => b.amount_normalized - a.amount_normalized);
      byAccount = Array.from(accMap.values()).map((a) => ({ ...a, income_normalized: round2(a.income_normalized), expense_normalized: round2(a.expense_normalized), net_normalized: round2(a.net_normalized) })).sort((a, b) => Math.abs(b.net_normalized) - Math.abs(a.net_normalized));
    }
  }

  // No-spend days & volatility (expense days by local date)
  let noSpend: { value: number | null; available: boolean; reason: string | null; basis: string } = { value: null, available: false, reason: "disabled", basis: "local_calendar_days_with_zero_expense_transactions" };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let volatility: any = null;
  if (options.metrics.noSpendDays || options.metrics.volatility) {
    const expenseByDay = new Map<string, number>();
    for (const r of txRows) if (r.type === "expense") {
      expenseByDay.set(r.date_local, (expenseByDay.get(r.date_local) || 0) + r.amount_normalized);
    }
    if (options.metrics.noSpendDays) {
      if (hasBoundedPeriod && periodStartDateLocal && periodEndDateLocal) {
        const days = localDayKeysBetween(periodStartDateLocal, periodEndDateLocal);
        let count = 0;
        for (const d of days) if (!expenseByDay.has(d)) count++;
        noSpend = { value: count, available: true, reason: null, basis: "count_of_local_calendar_days_in_bounded_period_with_no_expense_transactions" };
      } else {
        noSpend = { value: null, available: false, reason: options.preset === "all" ? "unbounded_period_all_no_fixed_calendar_range" : "no_bounded_period", basis: "local_calendar_days_with_zero_expense_transactions" };
      }
    }
    if (options.metrics.volatility) {
      const vals = Array.from(expenseByDay.values());
      const mean = vals.length ? sum(vals) / vals.length : 0;
      const variance = vals.length ? sum(vals.map((v) => (v - mean) ** 2)) / vals.length : 0;
      volatility = {
        expense_active_days_count: vals.length,
        min_day_expense_normalized: round2(vals.length ? Math.min(...vals) : 0),
        max_day_expense_normalized: round2(vals.length ? Math.max(...vals) : 0),
        avg_day_expense_on_active_days_normalized: round2(mean),
        stddev_day_expense_on_active_days_normalized: round2(Math.sqrt(variance)),
        basis: "days_with_at_least_one_expense_transaction_grouped_by_local_date",
      };
    }
  }

  // Transfer metrics (separate, non-ledger)
  const transferAmountNormalizedTotal = round2(sum(trRows.map((t) => t.amount_normalized_from)));
  const transferFeeNormalizedTotal = round2(sum(trRows.map((t) => t.fee_normalized_base || 0)));
  const transferFeeCount = trRows.filter((t) => (t.fee_amount || 0) > 0).length;
  const linkedToTransferCount = txRows.filter((t) => !!t.transfer_id_ref).length;
  const linkedToTradeCount = txRows.filter((t) => !!t.related_trade_ref).length;

  // Top transactions & highlights
  let topExpenseTx: TxRow[] = [];
  let topIncomeTx: TxRow[] = [];
  const highlights: string[] = [];
  if (options.metrics.topTransactions || options.metrics.highlights) {
    topExpenseTx = topN(txRows.filter((r) => r.type === "expense"), 10, (r) => r.amount_normalized);
    topIncomeTx = topN(txRows.filter((r) => r.type === "income"), 5, (r) => r.amount_normalized);
  }
  if (options.metrics.highlights) {
    if (topExpenseTx[0]) highlights.push(`Largest expense (normalized): ${fmtMoney(topExpenseTx[0].amount_normalized, baseCurrency, lang)} — ${topExpenseTx[0].category_name_display}, ${topExpenseTx[0].date_local}, account ${topExpenseTx[0].account_name} (${topExpenseTx[0].currency_original} ${fmtNum(topExpenseTx[0].amount_original, lang)} original).`);
    if (ledger.expense_normalized > ledger.income_normalized) highlights.push(`Ledger deficit: expenses exceed income by ${fmtMoney(round2(ledger.expense_normalized - ledger.income_normalized), baseCurrency, lang)} (normalized).`);
    else highlights.push(`Ledger net surplus: ${fmtMoney(ledger.net_cashflow_normalized, baseCurrency, lang)} (normalized).`);
    const uncatAmt = round2(sum(txRows.filter((r) => !r.category_id).map((r) => r.amount_normalized)));
    if (ledger.uncategorized_count > 0) highlights.push(`Uncategorized ledger transactions: ${ledger.uncategorized_count} (normalized total ${fmtMoney(uncatAmt, baseCurrency, lang)}).`);
    highlights.push(`Transfers (separate inter-account flow, excluded from ledger net): ${trRows.length} transfers, sent normalized ${fmtMoney(transferAmountNormalizedTotal, baseCurrency, lang)}, fees normalized ${fmtMoney(transferFeeNormalizedTotal, baseCurrency, lang)}. Reconciliation: ledger expense/net already includes any transfer fees recorded as ledger expense transactions; transfers_non_ledger.total_fee_normalized is separate and must not be added again without deduping via transfer_id_ref.`);
    if (prevMetrics?.available) highlights.push(`Vs previous period (normalized): income Δ ${prevMetrics.income_delta_normalized >= 0 ? "+" : ""}${fmtMoney(prevMetrics.income_delta_normalized, baseCurrency, lang)}, expense Δ ${prevMetrics.expense_delta_normalized >= 0 ? "+" : ""}${fmtMoney(prevMetrics.expense_delta_normalized, baseCurrency, lang)}, net Δ ${prevMetrics.net_delta_normalized >= 0 ? "+" : ""}${fmtMoney(prevMetrics.net_delta_normalized, baseCurrency, lang)}.`);
    else if (prevMetrics && !prevMetrics.available) highlights.push(`Previous-period comparison unavailable: ${prevMetrics.reason}.`);
  }

  // Build manifest, definitions, KPI (self-describing)
  const generatedAt = new Date().toISOString();
  const fxRatesStructured = Object.fromEntries(Object.entries(rates).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k, Number(v)]));
  const manifest = {
    schema_version: "2.0",
    export_type: "ai_cashflow_raw_ledger",
    generated_at: generatedAt,
    timezone: timeZone,
    requested_period: {
      preset: options.preset,
      start_local_inclusive: periodStartDateLocal,
      end_local_inclusive: periodEndDateLocal,
      start_utc_inclusive: rangeStart,
      end_utc_exclusive: rangeEnd,
      resolution: periodResolution,
      note: options.preset === "all" ? "All available records (no date bounds). Comparison and bounded-period day metrics are unavailable by design." : "Bounds are half-open [start_utc_inclusive, end_utc_exclusive) on transaction_date/transfer_date timestamps; local dates reflect user timezone intent.",
    },
    actual_data_range_covered: { ...actualDataRange, derived_from: "min/max date_local of included transaction and transfer rows in this export" },
    base_currency: baseCurrency,
    included_files: [
      { name: `cashflow-ai-summary-${generatedAt.slice(0,10)}.md`, type: "markdown" as const, rows: null as number | null, always_included: true, description: "manifest, definitions, KPIs, highlights" },
      ...(options.includeTransactionsCsv ? [{ name: `transactions-${generatedAt.slice(0,10)}.csv`, type: "csv" as const, rows: txRows.length, always_included: false, description: "ledger transactions (income/expense)" }] : []),
      ...(options.includeTransfersCsv ? [{ name: `transfers-${generatedAt.slice(0,10)}.csv`, type: "csv" as const, rows: trRows.length, always_included: false, description: "inter-account transfers (separate flow)" }] : []),
      ...(options.includeContextJson ? [{ name: `context-${generatedAt.slice(0,10)}.json`, type: "json" as const, rows: null as number | null, always_included: false, description: "snapshots, manifest meta, structured rates" }] : []),
    ],
    truncation: {
      trend_shown: trend.length,
      trend_total: trend.length,
      categories_shown_in_summary: Math.min(byCategory.length, 20),
      categories_total: byCategory.length,
      top_expenses_shown: topExpenseTx.length,
      top_income_shown: topIncomeTx.length,
      transfers_shown_in_summary: Math.min(trRows.length, 50),
      transfers_total: trRows.length,
    },
    read_order: ["cashflow-ai-summary-*.md (manifest, definitions, KPIs, highlights)", "transactions-*.csv if included (full ledger detail)", "transfers-*.csv if included (full transfer detail)", "context-*.json if included (structured snapshots/meta/rates)"],
  };

  const definitions = {
    schema_version: "2.0",
    glossary: {
      ledger: "Rows from transactions table in the selected period (income/expense), exported as-is for that scope.",
      net_cashflow: "Σ amount_normalized of income transactions − Σ amount_normalized of expense transactions, over ledger transactions only, in base_currency.",
      tx_count_ledger: "Count of ledger transaction rows in period (income + expense).",
      amount_original: "Original amount in the transaction/transfer native currency (currency_original/from_currency).",
      amount_normalized: "amount_original converted to base_currency using USD-base FX rates; formula: (amount_original / rate[currency_original_or_USD]) * rate[base_currency]. Rounded to 2 decimals per value.",
      base_currency: "User-selected normalization currency for comparable KPIs (default often IDR).",
      uncategorized: { canonical_key: "__uncategorized__", condition: "category_id is null/empty", display_label_id: "Tanpa Kategori", display_label_en: "Uncategorized" },
      transfer_flow: "Inter-account movement (transfers table). Separate from ledger income/expense and excluded from net_cashflow to avoid double-counting. Transfer fees may also appear as ledger expense transactions and can be linked via transfer_id_ref.",
      exchange_rate: "USD-base map value means 1 USD = rate[currency] units of that currency. Conversion uses: amount_usd = amount_original / rate[from]; amount_normalized = amount_usd * rate[base].",
      transfer_exchange_rate_field: "exchange_rate_used stored on transfer row (pair-specific as recorded by app); may differ in representation from USD-base normalization map.",
      fee_amount_fee_mode_net_amount: "Transfer fee fields from transfers table in from_currency context unless stated; fee_mode/net_amount are recorded values. fee_normalized_base is normalized estimate to base_currency using same USD-base rates and from_currency as fee currency basis.",
      transfer_id_ref: "Transaction row linked to a transfer (e.g. transfer-related fee or paired record) via transfer_id.",
      related_trade_ref: "Transaction row linked to investment trade (stock:/crypto:/etf: trade id).",
      trend_bucket_granularity: "Bounded period: daily_local if <= 120 calendar days else monthly_local. Unbounded/all: daily_local observed sparse buckets. Buckets are based on local dates in user timezone, ordered ascending, series_type=sparse_observed (filled_calendar=false): only periods with >=1 ledger transaction appear; missing bucket = zero ledger rows in that bucket, not missing export data.",
      share_pct_of_type: "Category amount_normalized as percentage of total income_normalized or expense_normalized for that same type (denominator = type total).",
      rounding_precision: "Monetary normalized amounts rounded to 2 decimals (round half up via epsilon method in code); FX rates shown as stored numeric values (up to source precision).",
      reconciliation_rule: "Ledger expense_normalized/net_cashflow_normalized already include any transfer fees recorded as ledger expense transactions. transfers_non_ledger.total_fee_normalized is a separate inter-account flow metric for analysis/reconciliation only; do NOT add it to ledger expense/net_cashflow without deduping via transfer_id_ref/linked rows (see reconciliation counts).",
    },
    units: {
      normalized_amounts: `currency = base_currency (${baseCurrency})`,
      original_amounts: "currency = currency_original / from_currency / to_currency as specified per row/field",
      account_balances_snapshot: "native per-account currency (current_balance/initial_balance); not normalized to base and not directly summable with ledger KPIs across different currencies",
      budget_snapshot: "native budget currency per row (limit/spent/remaining); representative approximation, not normalized to base, not part of ledger net",
    },
    csv_schemas: {
      "transactions.csv": {
        description: "Ledger transactions (income/expense) in period; same scope as net_cashflow. Read with summary/definitions for semantics.",
        columns: {
          date_iso: "Timestamp/string as stored (source transaction_date).",
          date_local: "Local calendar date (YYYY-MM-DD) in export timezone.",
          type: "income|expense (ledger).",
          amount_original: "Original amount in currency_original.",
          currency_original: "Original/native currency code.",
          amount_normalized: `Amount converted to base_currency (${baseCurrency}) using USD-base FX formula; rounded 2dp.`,
          base_currency: "Normalization target currency.",
          account_name: "Account name (display).",
          account_currency: "Account native currency.",
          category_key: "Canonical category key (__uncategorized__ when category_id null).",
          category_name_display: "Display/localized category name.",
          description_raw: "Original description text.",
          description_clean: "Cleaned description (metadata markers stripped).",
          tags: "Semicolon-separated tags (may be empty).",
          items_json: "JSON array of normalized items (may be empty).",
          transaction_id: "Transaction id.",
          account_id: "Account id.",
          category_id: "Category id or empty.",
          transfer_id_ref: "Linked transfer id if any (e.g. transfer fee recorded as ledger expense); use for reconciliation, not double-counting.",
          related_trade_ref: "Linked trade ref (stock:/crypto:/etf:) if any.",
          created_at: "Record creation timestamp.",
        },
      },
      "transfers.csv": {
        description: "Inter-account transfers (separate flow, excluded from ledger net_cashflow).",
        columns: {
          date_iso: "Timestamp/string as stored (source transfer_date).",
          date_local: "Local calendar date (YYYY-MM-DD) in export timezone.",
          from_account: "Source account name.",
          to_account: "Destination account name.",
          amount_original: "Transfer amount in from_currency (as recorded).",
          from_currency: "Source/from currency.",
          to_currency: "Destination/to currency.",
          amount_normalized_from: `amount_original converted from from_currency to base_currency (${baseCurrency}) using USD-base FX; basis for transfers_non_ledger totals.`,
          base_currency: "Normalization target currency.",
          exchange_rate_stored: "Stored transfer exchange rate (pair-specific as recorded by app; not the USD-base normalization map).",
          fee_amount_original: "Fee amount in fee currency basis (from_currency basis) or empty.",
          fee_currency_basis: "Currency basis for fee normalization (from_currency).",
          fee_mode: "Recorded fee mode or empty.",
          net_amount_stored: "Stored net amount (recorded) or empty.",
          fee_normalized_base: `Fee normalized to base_currency from from_currency basis; empty if no fee. Reconciliation: do NOT add to ledger expense/net (ledger may already include linked fee expense via transfer_id_ref).`,
          description: "Transfer description.",
          transfer_id: "Transfer id.",
        },
      },
    },
  };

  const kpi = {
    schema_version: "2.0",
    meta: {
      formulas: {
        net_cashflow_normalized: "sum(income amount_normalized) - sum(expense amount_normalized) over ledger transactions only",
        amount_normalized: "(amount_original / usd_base_rate[currency_original]) * usd_base_rate[base_currency], rounded to 2 decimals",
      },
      denominators: {
        share_pct_of_type: "total income_normalized or expense_normalized for the same transaction type",
        per_day_metrics: "calendar days in bounded period (user timezone) when available",
      },
      unavailable_metric_convention: "value null with available=false and reason string when metric is not meaningful/applicable",
    },
    period: { ...manifest.requested_period, days_in_period: perDayDenom ? metricWithMeta(perDayDenom, true, null) : metricWithMeta<number | null>(null, false, options.preset === "all" ? "unbounded_period_all" : "no_bounded_period") },
    ledger: ledger,
    totals_by_original_currency: byOriginalCurrency,
    averages: options.metrics.averagesMedian ? {
      per_tx_income_normalized: round2(incomeVals.length ? sum(incomeVals) / incomeVals.length : 0),
      per_tx_expense_normalized: round2(expenseVals.length ? sum(expenseVals) / expenseVals.length : 0),
      ...perDayMetrics,
    } : undefined,
    median: options.metrics.averagesMedian ? {
      tx_income_normalized: round2(median(incomeVals)),
      tx_expense_normalized: round2(median(expenseVals)),
    } : undefined,
    no_spend_days: options.metrics.noSpendDays ? noSpend : undefined,
    volatility: options.metrics.volatility ? volatility : undefined,
    comparison_previous: options.metrics.comparePrevious ? prevMetrics : undefined,
    trend_meta: options.metrics.trend ? {
      granularity: trendGranularity,
      bucket_count: trend.length,
      series_type: "sparse_observed",
      filled_calendar: false,
      rule: hasBoundedPeriod
        ? "monthly_local if bounded period > 120 calendar days, else daily_local; buckets are sparse/observed local periods with >=1 ledger transaction (missing bucket = zero ledger rows in that bucket, not missing export data)"
        : "daily_local for unbounded/all period (observed sparse local dates with >=1 ledger transaction; not a calendar-complete timeline)",
      all_period_note: options.preset === "all" ? "Unbounded/all period: trend shows observed daily_local activity only, not a complete daily calendar series." : null,
    } : undefined,
    transfers_non_ledger: {
      transfer_count: trRows.length,
      total_sent_amount_normalized_from_currency: { value: transferAmountNormalizedTotal, currency: baseCurrency, basis: "sum of amount_original converted from from_currency to base_currency" },
      total_fee_normalized: { value: transferFeeNormalizedTotal, currency: baseCurrency, basis: "sum of fee_amount converted from from_currency (fee currency basis) to base_currency; null fees treated as 0" },
      transfers_with_fee_count: transferFeeCount,
      note: "Transfers are inter-account flows, excluded from ledger income/expense/net_cashflow. Some transfer fees may also exist as ledger expense transactions (linked via transfer_id_ref).",
      reconciliation_rule: "Do NOT add total_fee_normalized to ledger expense/net_cashflow: ledger already includes transfer fees recorded as ledger expense transactions. Use reconciliation.transactions_linked_to_transfer and transfer_id_ref to dedupe.",
    },
    reconciliation: {
      transactions_linked_to_transfer: linkedToTransferCount,
      transactions_linked_to_trade: linkedToTradeCount,
    },
    fx: {
      base_currency: baseCurrency,
      policy: "USD-base rate map normalization",
      source: fxSource,
      fetched_at: fxFetchedAt,
      note: fxNote,
      rates_usd_base: fxRatesStructured,
      fallback_defaults_used: fxSource.startsWith("fallback"),
    },
  };

  // Build summary markdown
  const lines: string[] = [];
  lines.push(`# Pocketly — AI Cashflow Export`);
  lines.push(``);
  lines.push(`## How to read / Manifest`);
  lines.push(`- schema_version: ${manifest.schema_version} | export_type: ${manifest.export_type} | generated_at: ${generatedAt}`);
  lines.push(`- timezone: ${timeZone}`);
  lines.push(`- requested period: preset=${options.preset}, local=${periodStartDateLocal || "null"}..${periodEndDateLocal || "null"} (inclusive), utc=[${rangeStart || "null"}, ${rangeEnd || "null"}) half-open on transaction/transfer timestamps | resolution=${periodResolution}`);
  if (options.preset === "all") lines.push(`- preset "all": no date bounds (unbounded); actual_data_range_covered shows min/max local dates of returned rows. Comparison and bounded-calendar metrics (no_spend_days, per-day denominators/days_in_period) are n/a by design. Trend is daily_local sparse/observed (not calendar-complete).`);
  lines.push(`- actual data range covered (local dates from returned records): ${actualDataRange.start_local || "n/a"} .. ${actualDataRange.end_local || "n/a"} (has_data=${actualDataRange.has_data})`);
  lines.push(`- base_currency (normalized): ${baseCurrency}`);
  lines.push(`- read order: ${manifest.read_order.join(" -> ")}`);
  lines.push(`- included files:`);
  for (const f of manifest.included_files) lines.push(`  - ${f.name} (${f.type}${f.rows != null ? `, rows=${f.rows}` : ""}${f.description ? `, ${f.description}` : ""})`);
  lines.push(`- truncation: categories shown ${manifest.truncation.categories_shown_in_summary}/${manifest.truncation.categories_total}, top expenses ${manifest.truncation.top_expenses_shown}, top income ${manifest.truncation.top_income_shown}, transfers shown in summary ${manifest.truncation.transfers_shown_in_summary}/${manifest.truncation.transfers_total}`);
  lines.push(``);

  lines.push(`## Definitions / Glossary (concise)`);
  lines.push(`- ledger: transactions income/expense rows in period (as-is). net_cashflow_normalized = Σ income_normalized − Σ expense_normalized in ${baseCurrency} (ledger only). tx_count_ledger = income_count + expense_count.`);
  lines.push(`- amount_original/currency_original = native values; amount_normalized = converted to base_currency via USD-base rates: (amount_original / rate[from]) * rate[base], rounded 2dp. base_currency=${baseCurrency}.`);
  lines.push(`- uncategorized: canonical_key="__uncategorized__" when category_id null; display label "${uncatLabel}".`);
  lines.push(`- transfers: separate inter-account flow (not in ledger net). Fees may also exist as ledger expense transactions (link via transfer_id_ref). related_trade_ref links investment trades.`);
  lines.push(`- FX: source=${fxSource}${fxFetchedAt ? `, fetched_at=${fxFetchedAt}` : ""}; USD-base means 1 USD = X currency units. transfer.exchange_rate field is stored pair-specific; normalization uses USD-base map.`);
  lines.push(`- trend buckets: ${kpi.trend_meta ? `${kpi.trend_meta.granularity}, ${kpi.trend_meta.series_type} (${kpi.trend_meta.rule})` : "n/a"}. share_pct_of_type denominator = type income/expense total. unavailable metrics use null + reason.`);
  lines.push(`- reconciliation (transfer fees): ledger expense/net already includes any transfer fees recorded as ledger expense transactions; transfers_non_ledger.total_fee_normalized is separate and must NOT be added to ledger expense/net without deduping via transfer_id_ref (see reconciliation counts).`);
  lines.push(`- budget snapshot: representative/non-period-aligned approximation (month=${(budgetCaveat as { representative_month_start?: string } | null)?.representative_month_start || "n/a"}), grouped by category_id+currency in native currency, no carryover, not part of ledger net, not normalized/summable with ledger KPIs.`);
  lines.push(``);

  if (!compact) {
    lines.push(`## Examples (how to read)`);
    if (txRows[0]) {
      const ex = txRows[0];
      const rFrom = fxRatesStructured[ex.currency_original] || 1;
      const rBase = fxRatesStructured[baseCurrency] || 1;
      const calc = round2((ex.amount_original / rFrom) * rBase);
      lines.push(`- Transaction example: id=${ex.id}, type=${ex.type}, date_local=${ex.date_local}, ${ex.currency_original} ${fmtNum(ex.amount_original, lang)} original -> ${baseCurrency} ${fmtNum(ex.amount_normalized, lang)} normalized using (amount/rate[${ex.currency_original}])*rate[${baseCurrency}] = (${fmtNum(ex.amount_original, lang)}/${rFrom})*${rBase} ≈ ${fmtNum(calc, lang)} (2dp). Counted in ledger net_cashflow; category_key="${ex.category_key}".`);
    } else {
      lines.push(`- Transaction example: (no ledger transactions in period).`);
    }
    if (trRows[0]) {
      const ex = trRows[0];
      lines.push(`- Transfer example: id=${ex.id}, ${ex.date_local}, ${ex.from_account} -> ${ex.to_account}, sent ${ex.from_currency} ${fmtNum(ex.amount_original, lang)} (normalized to base ${baseCurrency} ${fmtNum(ex.amount_normalized_from, lang)} for separate transfer metrics). This is inter-account flow, NOT included in ledger income/expense/net. Fee=${ex.fee_amount ?? "none"} ${ex.fee_currency}${ex.fee_amount != null ? ` (normalized ${baseCurrency} ${fmtNum(ex.fee_normalized_base || 0, lang)})` : ""}; any transfer fee recorded as a ledger expense transaction would appear separately and may carry transfer_id_ref.`);
    } else {
      lines.push(`- Transfer example: (no transfers in period).`);
    }
    lines.push(``);
  }

  lines.push(`## Executive Summary (${baseCurrency}, normalized ledger)`);
  lines.push(`- Total income (normalized): ${fmtMoney(ledger.income_normalized, baseCurrency, lang)} | Total expense (normalized): ${fmtMoney(ledger.expense_normalized, baseCurrency, lang)} | Net cashflow (normalized): ${fmtMoney(ledger.net_cashflow_normalized, baseCurrency, lang)}`);
  lines.push(`- Ledger tx_count: ${ledger.tx_count_ledger} (income ${ledger.income_count}, expense ${ledger.expense_count}), uncategorized: ${ledger.uncategorized_count}`);
  lines.push(`- Transfers (separate, non-ledger): ${trRows.length} transfers, sent normalized ${fmtMoney(transferAmountNormalizedTotal, baseCurrency, lang)}, fees normalized ${fmtMoney(transferFeeNormalizedTotal, baseCurrency, lang)} (${transferFeeCount} with fee)`);
  lines.push(`- Period days (bounded calendar, local): ${daysInPeriod ?? "n/a"}${options.metrics.noSpendDays ? ` | no-spend days: ${noSpend.available ? noSpend.value : `n/a (${noSpend.reason})`}` : ""}`);
  if (prevMetrics?.available) {
    const ip = prevMetrics.income_pct_change.available ? `${prevMetrics.income_pct_change.value}%` : `n/a (${prevMetrics.income_pct_change.reason})`;
    const ep = prevMetrics.expense_pct_change.available ? `${prevMetrics.expense_pct_change.value}%` : `n/a (${prevMetrics.expense_pct_change.reason})`;
    lines.push(`- Vs previous period: income Δ ${prevMetrics.income_delta_normalized>=0?"+":""}${fmtMoney(prevMetrics.income_delta_normalized,baseCurrency,lang)} (${ip}), expense Δ ${prevMetrics.expense_delta_normalized>=0?"+":""}${fmtMoney(prevMetrics.expense_delta_normalized,baseCurrency,lang)} (${ep}), net Δ ${prevMetrics.net_delta_normalized>=0?"+":""}${fmtMoney(prevMetrics.net_delta_normalized,baseCurrency,lang)}`);
  } else if (options.metrics.comparePrevious) {
    lines.push(`- Vs previous period: n/a (${prevMetrics?.reason || "unavailable"})`);
  }
  if (highlights.length) for (const h of highlights.slice(0, compact ? 4 : 6)) lines.push(`- ${h}`);
  lines.push(``);

  if (!compact) {
    lines.push(`## FX & Normalization (reproducible)`);
    lines.push(`- base_currency: ${baseCurrency} | source: ${fxSource}${fxFetchedAt ? ` | fetched_at: ${fxFetchedAt}` : ""} | fallback_defaults_used: ${fxSource.startsWith("fallback")}`);
    lines.push(`- policy: USD-base rate map (1 USD = rate[currency]). amount_normalized = (amount_original / rate[from_currency_or_USD]) * rate[${baseCurrency}], rounded to 2 decimals.`);
    lines.push(`- rates (USD base): ${Object.entries(fxRatesStructured).map(([k,v])=>`${k}=${v}`).join(", ")}`);
    lines.push(``);
  }

  lines.push(`## KPI (self-describing, machine-readable)`);
  lines.push("```json");
  lines.push(JSON.stringify(kpi, null, 2));
  lines.push("```");
  lines.push(``);

  lines.push(`## Definitions (machine-readable, includes glossary/units/csv_schemas)`);
  lines.push("```json");
  lines.push(JSON.stringify(definitions, null, 2));
  lines.push("```");
  lines.push(``);

  if (options.metrics.trend && trend.length) {
    lines.push(`## Trend (${trendGranularity}, local buckets, sparse/observed, ordered asc)`);
    if (options.preset === "all") lines.push(`- Unbounded/all period: daily_local observed sparse series (not a calendar-complete timeline). Missing buckets = zero ledger rows in that bucket, not missing export data.`);
    else if (trendGranularity === "daily_local") lines.push(`- Sparse observed series: only local days with >=1 ledger transaction are shown; missing days = zero ledger rows (see no_spend_days metric when available).`);
    else lines.push(`- Sparse observed series: only local months with >=1 ledger transaction are shown; missing months = zero ledger rows in that month.`);
    lines.push(``);
    lines.push(`| Bucket (local) | Income (Normalized, ${baseCurrency}) | Expense (Normalized, ${baseCurrency}) | Net Cashflow (Normalized, ${baseCurrency}) | Tx Count (ledger) |`);
    lines.push(`|---|---:|---:|---:|---:|`);
    for (const t of trend) lines.push(`| ${t.bucket} | ${fmtNum(t.income_normalized,lang)} | ${fmtNum(t.expense_normalized,lang)} | ${fmtNum(t.net_cashflow_normalized,lang)} | ${t.tx_count_ledger} |`);
    lines.push(``);
  }

  if (options.metrics.breakdowns && !compact) {
    lines.push(`## Breakdown (ledger, normalized to ${baseCurrency})`);
    lines.push(``);
    lines.push(`### Categories (top ${Math.min(byCategory.length, 20)} of ${byCategory.length}; share % of type total)`);
    lines.push(``);
    lines.push(`| Category (display) | Category key (canonical) | Type | Amount (Normalized, ${baseCurrency}) | Share % of type | Tx Count (ledger) | Avg Tx (Normalized, ${baseCurrency}) |`);
    lines.push(`|---|---|---|---:|---:|---:|---:|`);
    for (const c of byCategory.slice(0, 20)) lines.push(`| ${c.category} | ${c.category_key} | ${c.type} | ${fmtNum(c.amount_normalized,lang)} | ${fmtMaybeNum(c.share_pct_of_type,lang)} | ${c.tx_count} | ${fmtNum(c.avg_tx_normalized,lang)} |`);
    lines.push(``);
    lines.push(`### Accounts (ledger flow, normalized; account currency is native label)`);
    lines.push(``);
    lines.push(`| Account | Account Currency (native) | Income (Normalized, ${baseCurrency}) | Expense (Normalized, ${baseCurrency}) | Net (Normalized, ${baseCurrency}) | Tx Count (ledger) |`);
    lines.push(`|---|---|---:|---:|---:|---:|`);
    for (const a of byAccount) lines.push(`| ${a.account} | ${a.account_currency} | ${fmtNum(a.income_normalized,lang)} | ${fmtNum(a.expense_normalized,lang)} | ${fmtNum(a.net_normalized,lang)} | ${a.tx_count} |`);
    lines.push(``);
  }

  if (byOriginalCurrency.length) {
    lines.push(`## Totals by Original Currency (ledger)`);
    lines.push(``);
    lines.push(`| Currency (Original) | Income (Original) | Expense (Original) | Income (Normalized, ${baseCurrency}) | Expense (Normalized, ${baseCurrency}) | Net (Normalized, ${baseCurrency}) | Tx Count |`);
    lines.push(`|---|---:|---:|---:|---:|---:|---:|`);
    for (const o of byOriginalCurrency) lines.push(`| ${o.currency_original} | ${fmtNum(o.income_original,lang)} | ${fmtNum(o.expense_original,lang)} | ${fmtNum(o.income_normalized,lang)} | ${fmtNum(o.expense_normalized,lang)} | ${fmtNum(o.net_normalized,lang)} | ${o.tx_count} |`);
    lines.push(``);
  }

  if (options.metrics.topTransactions) {
    lines.push(`## Top Transactions (ledger, evidence; amounts show original + normalized)`);
    lines.push(``);
    lines.push(`### Top Expenses (by normalized amount)`);
    lines.push(``);
    lines.push(`| Date (local) | Amount (Original) | Currency (Original) | Amount (Normalized, ${baseCurrency}) | Category (display) | Category key | Account | Description (clean) | Tags |`);
    lines.push(`|---|---:|---|---:|---|---|---|---|---|`);
    for (const r of topExpenseTx) lines.push(`| ${r.date_local} | ${fmtNum(r.amount_original,lang)} | ${r.currency_original} | ${fmtNum(r.amount_normalized,lang)} | ${r.category_name_display} | ${r.category_key} | ${r.account_name} | ${(r.description_clean||r.description_raw).replace(/\|/g,"/").slice(0,80)} | ${r.tags.join(",")} |`);
    lines.push(``);
    lines.push(`### Top Income (by normalized amount)`);
    lines.push(``);
    lines.push(`| Date (local) | Amount (Original) | Currency (Original) | Amount (Normalized, ${baseCurrency}) | Category (display) | Category key | Account | Description (clean) |`);
    lines.push(`|---|---:|---|---:|---|---|---|---|`);
    for (const r of topIncomeTx) lines.push(`| ${r.date_local} | ${fmtNum(r.amount_original,lang)} | ${r.currency_original} | ${fmtNum(r.amount_normalized,lang)} | ${r.category_name_display} | ${r.category_key} | ${r.account_name} | ${(r.description_clean||r.description_raw).replace(/\|/g,"/").slice(0,80)} |`);
    lines.push(``);
  }

  lines.push(`## Transfers — Inter-account Flow (SEPARATE, not in ledger net_cashflow)`);
  lines.push(`- count=${trRows.length}, sent total normalized (from_currency->base, basis documented): ${fmtMoney(transferAmountNormalizedTotal, baseCurrency, lang)}, fees total normalized (from_currency basis): ${fmtMoney(transferFeeNormalizedTotal, baseCurrency, lang)}.`);
  lines.push(`- Reconciliation: do NOT add transfer fees total to ledger expense/net_cashflow. Ledger already includes transfer fees recorded as ledger expense transactions (may be linked via transfer_id_ref; see reconciliation counts).`);
  if (trRows.length) {
    lines.push(``);
    lines.push(`| Date (local) | From Account | To Account | Amount (Original) | From Currency | To Currency | Amount (Normalized from, ${baseCurrency}) | Fee (Original, from currency) | Fee (Normalized, ${baseCurrency}) | Fee Mode | Transfer Rate (stored) | Net Amount (stored) | Description |`);
    lines.push(`|---|---|---|---:|---|---|---:|---:|---:|---|---:|---:|---|`);
    for (const t of trRows.slice(0, 50)) lines.push(`| ${t.date_local} | ${t.from_account} | ${t.to_account} | ${fmtNum(t.amount_original,lang)} | ${t.from_currency} | ${t.to_currency} | ${fmtNum(t.amount_normalized_from,lang)} | ${t.fee_amount ?? ""} | ${t.fee_normalized_base ?? ""} | ${t.fee_mode ?? ""} | ${t.exchange_rate ?? ""} | ${t.net_amount ?? ""} | ${(t.description||"").replace(/\|/g,"/").slice(0,60)} |`);
    if (trRows.length > 50) lines.push(`\n_(showing 50 of ${trRows.length} transfers in summary; see transfers.csv for full list)_`);
  } else {
    lines.push(`- (no transfers in period)`);
  }
  lines.push(``);

  if (!compact) {
    lines.push(`## Context Snapshots (non-ledger, caveated)`);
    lines.push(``);
    lines.push(`### Accounts snapshot (native currencies; not normalized/summable with ledger KPIs across currencies)`);
    if (accountsSnap.length) {
      lines.push(``);
      lines.push(`| Account | Type | Currency (native) | Current Balance (native) | Initial Balance (native) | Active |`);
      lines.push(`|---|---|---|---:|---:|---|`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const a of accountsSnap as any[]) lines.push(`| ${a.name || ""} | ${a.type || ""} | ${a.currency || ""} | ${fmtNum(Number(a.current_balance)||0, lang)} | ${fmtNum(Number(a.initial_balance)||0, lang)} | ${a.is_active ? "yes" : "no"} |`);
    } else lines.push(`- (no accounts)`);
    lines.push(``);
    lines.push(`### Budget snapshot (representative, non-period-aligned approximation)`);
    lines.push(`- caveat: ${JSON.stringify(budgetCaveat)}`);
    if (budgetsSnap.length) {
      lines.push(``);
      lines.push(`| Category | Category key | Period Start | Limit (native) | Spent (native) | Remaining (native) | Currency (native) |`);
      lines.push(`|---|---|---|---:|---:|---:|---|`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const b of budgetsSnap as any[]) lines.push(`| ${b.category} | ${b.category_key} | ${b.period_start} | ${fmtNum(b.limit_native, lang)} | ${fmtNum(b.spent_native, lang)} | ${fmtNum(b.remaining_native, lang)} | ${b.currency} |`);
    } else lines.push(`- (no budget snapshot)`);
    lines.push(``);
    lines.push(`### Active debts (native currency, not normalized)`);
    if (debtsSnap.length) {
      lines.push(``);
      lines.push(`| Name | Type | Status | Remaining (native) | Total (native) | Currency | Due |`);
      lines.push(`|---|---|---|---:|---:|---|---|`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const d of debtsSnap as any[]) lines.push(`| ${d.name || ""} | ${d.type || ""} | ${d.status || ""} | ${fmtNum(Number(d.remaining_native)||0,lang)} | ${fmtNum(Number(d.total_native)||0,lang)} | ${d.currency || ""} | ${d.due_date || ""} |`);
    } else lines.push(`- (none)`);
    lines.push(``);
    lines.push(`### Active goals (native currency, not normalized)`);
    if (goalsSnap.length) {
      lines.push(``);
      lines.push(`| Name | Status | Current (native) | Target (native) | Currency | Target date |`);
      lines.push(`|---|---|---:|---:|---|---|`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const g of goalsSnap as any[]) lines.push(`| ${g.name || ""} | ${g.status || ""} | ${fmtNum(Number(g.current_native)||0,lang)} | ${fmtNum(Number(g.target_native)||0,lang)} | ${g.currency || ""} | ${g.target_date || ""} |`);
    } else lines.push(`- (none)`);
    lines.push(``);
  }

  lines.push(`## Data Quality & Notes`);
  lines.push(`- Exported rows: transactions=${txRows.length}, transfers=${trRows.length}. uncategorized_ledger=${ledger.uncategorized_count}. linked_to_transfer=${linkedToTransferCount}, linked_to_trade=${linkedToTradeCount}.`);
  lines.push(`- FX: source=${fxSource}${fxFetchedAt ? `, fetched_at=${fxFetchedAt}` : ""}, base=${baseCurrency}, rates_usd_base=${JSON.stringify(fxRatesStructured)}.`);
  lines.push(`- Filter: [${rangeStart || "null"}, ${rangeEnd || "null"}) half-open on transaction_date/transfer_date. Ledger net uses only transactions (not transfers).`);
  lines.push(`- Data shown as-is from ledger scope (no Reports exclusion logic applied).`);
  lines.push(``);

  lines.push(`## Machine-readable block (manifest + kpi + definitions)`);
  lines.push("```json");
  lines.push(JSON.stringify({ manifest, kpi, definitions }, null, 2));
  lines.push("```");

  const summaryMd = lines.join("\n");

  // CSV builders (documented columns)
  const txCsvHeader = "date_iso,type,amount_original,currency_original,amount_normalized,base_currency,date_local,account_name,account_currency,category_key,category_name_display,description_raw,description_clean,tags,items_json,transaction_id,account_id,category_id,transfer_id_ref,related_trade_ref,created_at\n";
  let txCsv = txCsvHeader;
  for (const r of txRows) {
    txCsv += [
      r.date, r.type, r.amount_original, r.currency_original, r.amount_normalized, r.base_currency, r.date_local,
      csvCell(r.account_name), csvCell(r.account_currency), csvCell(r.category_key), csvCell(r.category_name_display),
      csvCell(r.description_raw), csvCell(r.description_clean), csvCell(r.tags.join(";")), csvCell(r.items_json),
      r.id, r.account_id, r.category_id || "", r.transfer_id_ref || "", r.related_trade_ref || "", r.created_at,
    ].join(",") + "\n";
  }
  const trCsvHeader = "date_iso,date_local,from_account,to_account,amount_original,from_currency,to_currency,amount_normalized_from,base_currency,exchange_rate_stored,fee_amount_original,fee_currency_basis,fee_mode,net_amount_stored,fee_normalized_base,description,transfer_id\n";
  let trCsv = trCsvHeader;
  for (const t of trRows) {
    trCsv += [
      t.date, t.date_local, csvCell(t.from_account), csvCell(t.to_account), t.amount_original, t.from_currency, t.to_currency,
      t.amount_normalized_from, t.base_currency, t.exchange_rate ?? "", t.fee_amount ?? "", t.fee_currency, t.fee_mode ?? "", t.net_amount ?? "", t.fee_normalized_base ?? "",
      csvCell(t.description), t.id,
    ].join(",") + "\n";
  }
  const contextJson = JSON.stringify({
    schema_version: "2.0",
    manifest,
    kpi,
    definitions,
    snapshots: {
      accounts: accountsSnap,
      budgets: budgetsSnap,
      budget_caveat: budgetCaveat,
      debts: debtsSnap,
      goals: goalsSnap,
    },
    fx: kpi.fx,
  }, null, 2);

  const ts = generatedAt.slice(0, 10);
  const files: { name: string; content: string }[] = [{ name: `cashflow-ai-summary-${ts}.md`, content: summaryMd }];
  if (options.includeTransactionsCsv) files.push({ name: `transactions-${ts}.csv`, content: txCsv });
  if (options.includeTransfersCsv) files.push({ name: `transfers-${ts}.csv`, content: trCsv });
  if (options.includeContextJson) files.push({ name: `context-${ts}.json`, content: contextJson });

  // update manifest included file rows/names consistency? names already use ts; ok.
  if (files.length === 1) {
    return { filename: files[0].name, mime: "text/markdown", content: files[0].content, encoding: "utf-8" };
  }

  const zip = new JSZip();
  for (const f of files) zip.file(f.name, f.content);
  const b64 = await zip.generateAsync({ type: "base64" });
  return { filename: `pocketly-ai-cashflow-${ts}.zip`, mime: "application/zip", content: b64, encoding: "base64" };
}
