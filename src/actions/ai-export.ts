"use server";

import JSZip from "jszip";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { convertAmount, type ForexRatesMap, DEFAULT_FALLBACK_RATES } from "@/lib/utils/currency";
import { getLatestForexRates } from "@/actions/exchange-rate";
import { getAssetPrices, type AssetPrice } from "@/lib/net-worth/prices";
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
  includeTradesCsv?: boolean;
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
  /** Actual trade id when linked (related_trade_ref = <trade_id>) for reconciliation with trades.csv. */
  related_trade_ref: string | null;
  stock_trade_id: string | null;
  crypto_trade_id: string | null;
  etf_trade_id: string | null;
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
  from_account_id: string;
  to_account_id: string;
  from_account_type: string | null;
  to_account_type: string | null;
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

interface TradeRow {
  trade_id: string;
  date_iso: string;
  date_local: string;
  asset_class: "stock" | "etf" | "crypto";
  symbol: string;
  type: "buy" | "sell";
  account_name: string;
  quantity: number;
  lots: number | null;
  price_per_unit: number;
  settlement_currency: string;
  gross_amount: number;
  fee_amount: number;
  stamp_duty: number;
  net_amount_original: number;
  net_amount_normalized: number;
  base_currency: string;
  cost_basis_sold: number | null;
  realized_pnl_normalized: number | null;
  notes: string;
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
function roundN(n: number, d = 8) {
  const p = 10 ** d;
  return Math.round((n + Number.EPSILON) * p) / p;
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
function isTradeLinkedTx(r: Pick<TxRow, "related_trade_ref" | "stock_trade_id" | "crypto_trade_id" | "etf_trade_id">) {
  return !!(r.related_trade_ref || r.stock_trade_id || r.crypto_trade_id || r.etf_trade_id);
}
function normalizeToBase(amount: number, currency: string, baseCurrency: string, rates: ForexRatesMap) {
  return round2(convertAmount(amount || 0, currency || "IDR", baseCurrency, rates));
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
  const includeTradesCsv = options.includeTradesCsv !== false; // default true for wealth export with trades data
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
    const { data: fxRows } = await supabase
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
      try {
        rates = await getLatestForexRates();
        fxSource = "latest_stored_exchange_rates_action";
        fxNote = "latest stored exchange rates (USD base)";
      } catch { /* keep default */ }
    }
  } catch {
    try {
      rates = await getLatestForexRates();
      fxSource = "latest_stored_exchange_rates_action";
      fxNote = "latest stored exchange rates (USD base)";
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
      "id, transaction_date, type, amount, currency, description, tags, items, created_at, account_id, category_id, transfer_id, crypto_trade_id, stock_trade_id, etf_trade_id, account:accounts(name,currency,type), category:categories(name,type)",
    )
    .order("transaction_date", { ascending: true });
  if (rangeStart) txQuery = txQuery.gte("transaction_date", rangeStart);
  if (rangeEnd) txQuery = txQuery.lt("transaction_date", rangeEnd);

  // 2) Transfers in period (separate flow)
  let trQuery = supabase
    .from("transfers")
    .select(
      "id, transfer_date, from_account_id, to_account_id, amount, from_currency, to_currency, exchange_rate_used, fee_amount, fee_mode, net_amount, description, from_account:accounts!transfers_from_account_id_fkey(name,currency,type), to_account:accounts!transfers_to_account_id_fkey(name,currency,type)",
    )
    .order("transfer_date", { ascending: true });
  if (rangeStart) trQuery = trQuery.gte("transfer_date", rangeStart);
  if (rangeEnd) trQuery = trQuery.lt("transfer_date", rangeEnd);

  // 3) Accounts snapshot (all)
  const accountsQuery = supabase
    .from("accounts")
    .select("id,name,type,currency,current_balance,initial_balance,is_active,is_default")
    .order("created_at", { ascending: true });

  // 4) Trades in period (unified) - optional but fetched when selected or needed for cashflow_adjusted exclusions/basis
  let stockTradesQuery = supabase
    .from("stock_trades")
    .select("id, trade_date, ticker, type, account_id, lots, shares, price_per_share, net_amount, buy_cost, realized_pnl, stamp_duty, notes, currency, created_at, account:accounts(name,currency)")
    .order("trade_date", { ascending: true });
  if (rangeStart) stockTradesQuery = stockTradesQuery.gte("trade_date", rangeStart);
  if (rangeEnd) stockTradesQuery = stockTradesQuery.lt("trade_date", rangeEnd);

  let cryptoTradesQuery = supabase
    .from("crypto_trades")
    .select("id, trade_date, symbol, type, account_id, quantity, gross_amount, fee_amount, fee_currency, price_per_unit, cost_basis, realized_pnl, notes, currency, created_at, account:accounts(name,currency)")
    .order("trade_date", { ascending: true });
  if (rangeStart) cryptoTradesQuery = cryptoTradesQuery.gte("trade_date", rangeStart);
  if (rangeEnd) cryptoTradesQuery = cryptoTradesQuery.lt("trade_date", rangeEnd);

  let etfTradesQuery = supabase
    .from("etf_trades")
    .select("id, trade_date, ticker, type, account_id, quantity, price_per_unit, gross_amount, fee_amount, buy_cost, realized_pnl, notes, currency, created_at, account:accounts(name,currency)")
    .order("trade_date", { ascending: true });
  if (rangeStart) etfTradesQuery = etfTradesQuery.gte("trade_date", rangeStart);
  if (rangeEnd) etfTradesQuery = etfTradesQuery.lt("trade_date", rangeEnd);

  // 5) Holdings snapshots (all active/relevant)
  const stockHoldingsQuery = supabase.from("stock_holdings").select("id, ticker, account_id, currency, lots, total_shares, total_cost, avg_buy_price, account:accounts(name,currency)");
  const cryptoHoldingsQuery = supabase.from("crypto_holdings").select("id, symbol, name, account_id, quantity, cost_basis, average_buy_price, price_currency, manual_price, account:accounts(name,currency)");
  const etfHoldingsQuery = supabase.from("etf_holdings").select("id, ticker, account_id, currency, quantity, total_cost, avg_buy_price, broker_name, account:accounts(name,currency)");

  const [txRes, trRes, accRes, stRes, ctRes, etRes, shRes, chRes, ehRes, prices] = await Promise.all([
    txQuery, trQuery, accountsQuery,
    stockTradesQuery, cryptoTradesQuery, etfTradesQuery,
    stockHoldingsQuery, cryptoHoldingsQuery, etfHoldingsQuery,
    getAssetPrices(supabase as never),
  ]);
  if (txRes.error) throw new Error(`Export failed: ${txRes.error.message}`);
  if (trRes.error) throw new Error(`Export failed: ${trRes.error.message}`);
  if (accRes.error) throw new Error(`Export failed: ${accRes.error.message}`);
  if (stRes.error) throw new Error(`Export failed: ${stRes.error.message}`);
  if (ctRes.error) throw new Error(`Export failed: ${ctRes.error.message}`);
  if (etRes.error) throw new Error(`Export failed: ${etRes.error.message}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawTx = (txRes.data || []) as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawTr = (trRes.data || []) as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const accountsSnapRaw = (accRes.data || []) as any[];

  const uncatLabel = lang === "id" ? "Tanpa Kategori" : "Uncategorized";
  const txRows: TxRow[] = rawTx.map((t) => {
    const currencyOriginal = t.currency || t.account?.currency || "IDR";
    const amountOriginal = Number(t.amount) || 0;
    const amount_normalized = round2(convertAmount(amountOriginal, currencyOriginal, baseCurrency, rates));
    const categoryName = t.category?.name || "";
    const items = normalizeStoredItems(t.items) || [];
    // Reconciliation: related_trade_ref references the actual <trade_id> for trade-linked mirror rows
    const tradeId = t.stock_trade_id || t.crypto_trade_id || t.etf_trade_id || null;
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
      related_trade_ref: tradeId,
      stock_trade_id: t.stock_trade_id || null,
      crypto_trade_id: t.crypto_trade_id || null,
      etf_trade_id: t.etf_trade_id || null,
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
      from_account_id: tr.from_account_id || "",
      to_account_id: tr.to_account_id || "",
      from_account_type: tr.from_account?.type || null,
      to_account_type: tr.to_account?.type || null,
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

  // Unified trades rows (period) from actual trade tables: buy/sell only
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stockTrades = (stRes.data || []) as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cryptoTrades = (ctRes.data || []) as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const etfTrades = (etRes.data || []) as any[];

  const tradeRows: TradeRow[] = [];
  for (const t of stockTrades) {
    const settlementCurrency = t.currency || t.account?.currency || "IDR";
    const lots = t.lots != null ? Number(t.lots) : (t.shares != null ? Number(t.shares) / 100 : null);
    const shares = t.shares != null ? Number(t.shares) : (t.lots != null ? Number(t.lots) * 100 : 0);
    const quantity = shares || (lots != null ? lots * 100 : 0);
    const pricePerUnit = t.price_per_share != null ? Number(t.price_per_share) : (quantity ? Number(t.net_amount || 0) / quantity : 0);
    const grossAmount = quantity * pricePerUnit;
    const stampDuty = Number(t.stamp_duty || 0);
    const netAmountStored = Number(t.net_amount || 0);
    // Best-effort cash effect from real fields: buy cash out ~= net_amount + stamp_duty; sell cash in ~= net_amount - stamp_duty.
    const netAmountOriginal = t.type === "buy" ? netAmountStored + stampDuty : netAmountStored - stampDuty;
    const costBasisSold = t.type === "sell" ? Number(t.buy_cost || 0) : null;
    const realizedPnlOrig = t.type === "sell" && t.realized_pnl != null ? Number(t.realized_pnl) : null;
    tradeRows.push({
      trade_id: t.id,
      date_iso: t.trade_date,
      date_local: dateKeyFromIsoLocal(t.trade_date, timeZone),
      asset_class: "stock",
      symbol: String(t.ticker || "").toUpperCase(),
      type: t.type,
      account_name: t.account?.name || "",
      quantity,
      lots,
      price_per_unit: pricePerUnit,
      settlement_currency: settlementCurrency,
      gross_amount: round2(grossAmount),
      fee_amount: 0,
      stamp_duty: round2(stampDuty),
      net_amount_original: round2(netAmountOriginal),
      net_amount_normalized: normalizeToBase(netAmountOriginal, settlementCurrency, baseCurrency, rates),
      base_currency: baseCurrency,
      cost_basis_sold: costBasisSold != null ? round2(costBasisSold) : null,
      realized_pnl_normalized: realizedPnlOrig != null ? normalizeToBase(realizedPnlOrig, settlementCurrency, baseCurrency, rates) : null,
      notes: t.notes || "",
    });
  }
  for (const t of cryptoTrades) {
    const settlementCurrency = t.currency || t.fee_currency || t.account?.currency || "IDR";
    const quantity = Number(t.quantity || 0);
    const grossAmount = Number(t.gross_amount || 0);
    const feeAmount = Number(t.fee_amount || 0);
    const pricePerUnit = t.price_per_unit != null ? Number(t.price_per_unit) : (quantity ? grossAmount / quantity : 0);
    const netAmountOriginal = t.type === "buy" ? grossAmount + feeAmount : grossAmount - feeAmount;
    const costBasisSold = t.type === "sell" ? Number(t.cost_basis || 0) : null;
    const realizedPnlOrig = t.type === "sell" && t.realized_pnl != null ? Number(t.realized_pnl) : null;
    tradeRows.push({
      trade_id: t.id,
      date_iso: t.trade_date,
      date_local: dateKeyFromIsoLocal(t.trade_date, timeZone),
      asset_class: "crypto",
      symbol: String(t.symbol || "").toUpperCase(),
      type: t.type,
      account_name: t.account?.name || "",
      quantity,
      lots: null,
      price_per_unit: pricePerUnit,
      settlement_currency: settlementCurrency,
      gross_amount: round2(grossAmount),
      fee_amount: round2(feeAmount),
      stamp_duty: 0,
      net_amount_original: round2(netAmountOriginal),
      net_amount_normalized: normalizeToBase(netAmountOriginal, settlementCurrency, baseCurrency, rates),
      base_currency: baseCurrency,
      cost_basis_sold: costBasisSold != null ? round2(costBasisSold) : null,
      realized_pnl_normalized: realizedPnlOrig != null ? normalizeToBase(realizedPnlOrig, settlementCurrency, baseCurrency, rates) : null,
      notes: t.notes || "",
    });
  }
  for (const t of etfTrades) {
    const settlementCurrency = t.currency || t.account?.currency || "IDR";
    const quantity = Number(t.quantity || 0);
    const grossAmount = Number(t.gross_amount || 0);
    const feeAmount = Number(t.fee_amount || 0);
    const pricePerUnit = t.price_per_unit != null ? Number(t.price_per_unit) : (quantity ? grossAmount / quantity : 0);
    const netAmountOriginal = t.type === "buy" ? grossAmount + feeAmount : grossAmount - feeAmount;
    const costBasisSold = t.type === "sell" ? Number(t.buy_cost || 0) : null;
    const realizedPnlOrig = t.type === "sell" && t.realized_pnl != null ? Number(t.realized_pnl) : null;
    tradeRows.push({
      trade_id: t.id,
      date_iso: t.trade_date,
      date_local: dateKeyFromIsoLocal(t.trade_date, timeZone),
      asset_class: "etf",
      symbol: String(t.ticker || "").toUpperCase(),
      type: t.type,
      account_name: t.account?.name || "",
      quantity,
      lots: null,
      price_per_unit: pricePerUnit,
      settlement_currency: settlementCurrency,
      gross_amount: round2(grossAmount),
      fee_amount: round2(feeAmount),
      stamp_duty: 0,
      net_amount_original: round2(netAmountOriginal),
      net_amount_normalized: normalizeToBase(netAmountOriginal, settlementCurrency, baseCurrency, rates),
      base_currency: baseCurrency,
      cost_basis_sold: costBasisSold != null ? round2(costBasisSold) : null,
      realized_pnl_normalized: realizedPnlOrig != null ? normalizeToBase(realizedPnlOrig, settlementCurrency, baseCurrency, rates) : null,
      notes: t.notes || "",
    });
  }
  tradeRows.sort((a, b) => (a.date_iso < b.date_iso ? -1 : a.date_iso > b.date_iso ? 1 : a.trade_id.localeCompare(b.trade_id)));

  // Actual data range (local dates) from returned records
  const allDatesLocal = [...txRows.map((r) => r.date_local), ...trRows.map((r) => r.date_local), ...tradeRows.map((r) => r.date_local)].sort();
  const actualDataRange = {
    start_local: allDatesLocal[0] || null,
    end_local: allDatesLocal[allDatesLocal.length - 1] || null,
    has_data: allDatesLocal.length > 0,
  };

  // Holdings snapshot (actual app data) with market valuation using cached prices (market-or-cost fallback)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stockHoldings = (shRes.data || []) as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cryptoHoldings = (chRes.data || []) as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const etfHoldings = (ehRes.data || []) as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const holdingsSnap: any[] = [];
  const pushHolding = (args: {
    id: string; asset_class: "stock"|"etf"|"crypto"; symbol: string; name: string | null;
    account_id: string; account_name: string; quantity: number; lots: number | null; settlement_currency: string;
    cost_basis_original: number; avg_price_original: number;
  }) => {
    const qty = args.quantity || 0;
    const settlement = args.settlement_currency || "IDR";
    const cost = args.cost_basis_original || 0;
    const cached = prices.get(`${args.asset_class}:${args.symbol.toUpperCase()}`) as AssetPrice | undefined;
    let marketPriceOriginal: number | null = null;
    let marketValueOriginal: number | null = null;
    let marketValueNormalized = 0;
    let valuationSource = "cost_fallback_no_cached_price";
    let priceFetchedAt: string | null = null;
    const costBasisNormalized = normalizeToBase(cost, settlement, baseCurrency, rates);
    if (cached && cached.price > 0 && qty > 0) {
      // cached price in cached.currency; convert to settlement/original for display and to base for normalized
      marketPriceOriginal = roundN(convertAmount(cached.price, cached.currency || "IDR", settlement, rates), 8);
      marketValueOriginal = round2(marketPriceOriginal * qty);
      marketValueNormalized = normalizeToBase(cached.price * qty, cached.currency || "IDR", baseCurrency, rates);
      valuationSource = "cached_market_price";
      priceFetchedAt = cached.fetchedAt || null;
    } else {
      marketPriceOriginal = args.avg_price_original || null;
      marketValueOriginal = round2(cost);
      marketValueNormalized = costBasisNormalized;
      if (!(qty > 0)) valuationSource = "cost_fallback_zero_quantity";
    }
    const unrealizedPnlNormalized = round2(marketValueNormalized - costBasisNormalized);
    const unrealizedPnlPct = costBasisNormalized > 0 ? round2((unrealizedPnlNormalized / costBasisNormalized) * 100) : null;
    holdingsSnap.push({
      id: args.id,
      asset_class: args.asset_class,
      symbol: args.symbol,
      ...(args.name ? { name: args.name } : {}),
      account_id: args.account_id,
      account_name: args.account_name,
      quantity: args.quantity,
      ...(args.lots != null ? { lots: args.lots } : {}),
      settlement_currency: settlement,
      cost_basis_original: round2(cost),
      average_buy_price_original: roundN(args.avg_price_original || 0, 8),
      market_price_original: marketPriceOriginal,
      market_value_original: marketValueOriginal,
      market_value_normalized: round2(marketValueNormalized),
      unrealized_pnl_normalized: unrealizedPnlNormalized,
      unrealized_pnl_pct: unrealizedPnlPct,
      price_fetched_at: priceFetchedAt,
      valuation_source: valuationSource,
    });
  };
  for (const h of stockHoldings) {
    const settlement = h.currency || h.account?.currency || "IDR";
    const shares = Number(h.total_shares) || Number(h.lots || 0) * 100 || 0;
    pushHolding({ id: h.id, asset_class: "stock", symbol: String(h.ticker || "").toUpperCase(), name: null, account_id: h.account_id || "", account_name: h.account?.name || "", quantity: shares, lots: h.lots != null ? Number(h.lots) : null, settlement_currency: settlement, cost_basis_original: Number(h.total_cost || 0), avg_price_original: Number(h.avg_buy_price || 0) });
  }
  for (const h of cryptoHoldings) {
    const settlement = h.price_currency || "IDR";
    pushHolding({ id: h.id, asset_class: "crypto", symbol: String(h.symbol || "").toUpperCase(), name: h.name || null, account_id: h.account_id || "", account_name: h.account?.name || "", quantity: Number(h.quantity || 0), lots: null, settlement_currency: settlement, cost_basis_original: Number(h.cost_basis || 0), avg_price_original: Number(h.average_buy_price || 0) });
  }
  for (const h of etfHoldings) {
    const settlement = h.currency || h.account?.currency || "IDR";
    pushHolding({ id: h.id, asset_class: "etf", symbol: String(h.ticker || "").toUpperCase(), name: null, account_id: h.account_id || "", account_name: h.account?.name || "", quantity: Number(h.quantity || 0), lots: null, settlement_currency: settlement, cost_basis_original: Number(h.total_cost || 0), avg_price_original: Number(h.avg_buy_price || 0) });
  }

  // Debts snapshot (from real debt records) + net worth liabilities/receivables
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let debtsSnap: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let goalsSnap: any[] = [];
  try {
    const [d, g] = await Promise.all([getDebts("all", "active"), getSavingsGoals()]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    debtsSnap = (d || []).map((x: any) => {
      const currency = x.currency || "IDR";
      const principal = Number(x.initial_amount) || 0;
      const remaining = Number(x.remaining_amount) || 0;
      return {
        id: x.id,
        counterparty: x.counterparty_name,
        type: x.type === "receivable" ? "receivable" : "payable",
        principal_amount_original: principal,
        remaining_amount_original: remaining,
        currency,
        remaining_normalized: normalizeToBase(remaining, currency, baseCurrency, rates),
        status: x.status || "active",
        due_date: x.due_date || null,
      };
    });
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
  let byOriginalCurrency: any[] = [];
  {
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
      for (const r of txRows) {
        const ck = `${r.type}:${r.category_key}`;
        if (!catMap.has(ck)) catMap.set(ck, { category_key: r.category_key, category: r.category_name_display, type: r.type, amount_normalized: 0, tx_count: 0 });
        const c = catMap.get(ck);
        c.amount_normalized += r.amount_normalized; c.tx_count += 1;
      }
      const catRows = Array.from(catMap.values()).map((c) => {
        const denom = c.type === "income" ? ledger.income_normalized : ledger.expense_normalized;
        return { ...c, amount_normalized: round2(c.amount_normalized), share_pct_of_type: pctValue(c.amount_normalized, denom), avg_tx_normalized: round2(c.tx_count ? c.amount_normalized / c.tx_count : 0) };
      });
      byCategory = [...catRows].sort((a, b) => b.amount_normalized - a.amount_normalized);
    }
  }

  // No-spend days & volatility
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
  const linkedToTradeCount = txRows.filter((t) => isTradeLinkedTx(t)).length;

  // ---- cashflow_adjusted (best-effort, heuristic) ----
  const isLoanPrincipalCategory = (name: string) => name === "Loan & Debt";
  const isDiscrepancyCategory = (name: string) => name === "Discrepancy";
  let excludedTradeMirrorExpense = 0, excludedTradeMirrorIncome = 0, excludedLoanPrincipalOut = 0, excludedLoanPrincipalIn = 0, excludedDiscrepancyOut = 0, excludedDiscrepancyIn = 0;
  let opIncome = 0, opExpense = 0;
  for (const r of txRows) {
    const amt = r.amount_normalized;
    const tradeMirror = isTradeLinkedTx(r);
    const loan = isLoanPrincipalCategory(r.category_name);
    const disc = isDiscrepancyCategory(r.category_name);
    if (tradeMirror) {
      if (r.type === "expense") excludedTradeMirrorExpense += amt; else excludedTradeMirrorIncome += amt;
      continue; // excluded from operating (already represented in trades/capital flows)
    }
    if (loan) {
      if (r.type === "expense") excludedLoanPrincipalOut += amt; else excludedLoanPrincipalIn += amt;
      continue;
    }
    if (disc) {
      if (r.type === "expense") excludedDiscrepancyOut += amt; else excludedDiscrepancyIn += amt;
      continue;
    }
    if (r.type === "income") opIncome += amt; else opExpense += amt;
  }
  // Investment capital deployments via transfers to/from investment accounts (separate non-ledger flow; reported as excluded capital)
  let excludedCapitalOutflow = 0, excludedCapitalInflow = 0;
  for (const tr of trRows) {
    const toInv = tr.to_account_type === "investment";
    const fromInv = tr.from_account_type === "investment";
    if (toInv && !fromInv) excludedCapitalOutflow += tr.amount_normalized_from;
    else if (fromInv && !toInv) excludedCapitalInflow += tr.amount_normalized_from;
    // investment<->investment internal moves not counted as external capital deployment
  }
  const operatingIncome = round2(opIncome);
  const operatingExpense = round2(opExpense);
  const operatingNet = round2(operatingIncome - operatingExpense);
  const operatingSavingsRate = operatingIncome > 0 ? round2((operatingNet / operatingIncome) * 100) : null;
  const cashflowAdjusted = {
    operating_income_normalized: operatingIncome,
    operating_expense_normalized: operatingExpense,
    operating_net_surplus_normalized: operatingNet,
    operating_savings_rate_pct: operatingSavingsRate,
    excluded_capital_outflow_normalized: round2(excludedCapitalOutflow),
    excluded_capital_inflow_normalized: round2(excludedCapitalInflow),
    excluded_loan_principal_out_normalized: round2(excludedLoanPrincipalOut),
    excluded_loan_principal_in_normalized: round2(excludedLoanPrincipalIn),
    excluded_discrepancy_net_normalized: round2(excludedDiscrepancyOut - excludedDiscrepancyIn),
    basis: "Best-effort operating view from real Pocketly data. Excludes (a) trade-linked mirror transaction rows (stock_trade_id/crypto_trade_id/etf_trade_id -> related_trade_ref) to reduce double-counting with trades, (b) transactions in canonical system category 'Loan & Debt' treated as debt/principal movements, and (c) transactions in canonical system category 'Discrepancy' treated as balance adjustments. excluded_capital_* are heuristic: inter-account transfers to/from accounts with type 'investment' (separate non-ledger flow); investment<->investment transfers excluded from these buckets. Classification depends on stored categories, refs, and account types and is not a guaranteed accounting statement.",
    excluded_trade_mirror_expense_normalized: round2(excludedTradeMirrorExpense),
    excluded_trade_mirror_income_normalized: round2(excludedTradeMirrorIncome),
    excluded_discrepancy_out_normalized: round2(excludedDiscrepancyOut),
    excluded_discrepancy_in_normalized: round2(excludedDiscrepancyIn),
  };

  // ---- Net worth & portfolio (from real app data) ----
  const isCashAndBankAccount = (type: string | null | undefined) => ["bank", "cash", "ewallet"].includes(String(type || ""));
  const isInvestmentAccount = (type: string | null | undefined) => String(type || "") === "investment";
  let cashAndBankNormalized = 0;
  let uninvestedBrokerageCashNormalized = 0;
  for (const a of accountsSnapRaw) {
    const bal = Number(a.current_balance) || 0;
    const cur = a.currency || "IDR";
    const val = convertAmount(bal, cur, baseCurrency, rates);
    if (isCashAndBankAccount(a.type) && a.is_active !== false) cashAndBankNormalized += val;
    else if (isInvestmentAccount(a.type) && a.is_active !== false) uninvestedBrokerageCashNormalized += val;
    // other account types (e.g. credit_card) not included in liquid cash buckets
  }
  cashAndBankNormalized = round2(cashAndBankNormalized);
  uninvestedBrokerageCashNormalized = round2(uninvestedBrokerageCashNormalized);
  const totalLiquidCashNormalized = round2(cashAndBankNormalized + uninvestedBrokerageCashNormalized);

  const investedMarketByClass = { stock: 0, etf: 0, crypto: 0 } as Record<string, number>;
  const costByClass = { stock: 0, etf: 0, crypto: 0 } as Record<string, number>;
  let totalInvestedMarket = 0, totalCostBasis = 0, totalUnrealized = 0, activeHoldingsCount = 0;
  for (const h of holdingsSnap) {
    totalInvestedMarket += Number(h.market_value_normalized) || 0;
    const costNorm = normalizeToBase(Number(h.cost_basis_original) || 0, h.settlement_currency || "IDR", baseCurrency, rates);
    totalCostBasis += costNorm;
    totalUnrealized += Number(h.unrealized_pnl_normalized) || 0;
    if ((Number(h.quantity) || 0) > 0 || (Number(h.market_value_normalized) || 0) !== 0) activeHoldingsCount++;
    const cls = h.asset_class as keyof typeof investedMarketByClass;
    if (investedMarketByClass[cls] != null) investedMarketByClass[cls] += Number(h.market_value_normalized) || 0;
    if (costByClass[cls] != null) costByClass[cls] += costNorm;
  }
  totalInvestedMarket = round2(totalInvestedMarket);
  totalCostBasis = round2(totalCostBasis);
  totalUnrealized = round2(totalUnrealized);

  const totalLiabilitiesNormalized = round2(sum(debtsSnap.filter((d) => d.type === "payable").map((d) => Number(d.remaining_normalized) || 0)));
  const totalReceivablesNormalized = round2(sum(debtsSnap.filter((d) => d.type === "receivable").map((d) => Number(d.remaining_normalized) || 0)));
  const totalAssetsNormalized = round2(totalLiquidCashNormalized + totalInvestedMarket + totalReceivablesNormalized);
  const netWorthNormalized = round2(totalAssetsNormalized - totalLiabilitiesNormalized);
  const allocBase = totalAssetsNormalized || 0;
  const allocationPct = {
    cash_and_bank: allocBase ? round2((cashAndBankNormalized / allocBase) * 100) : 0,
    uninvested_brokerage_cash: allocBase ? round2((uninvestedBrokerageCashNormalized / allocBase) * 100) : 0,
    stock: allocBase ? round2((investedMarketByClass.stock / allocBase) * 100) : 0,
    etf: allocBase ? round2((investedMarketByClass.etf / allocBase) * 100) : 0,
    crypto: allocBase ? round2((investedMarketByClass.crypto / allocBase) * 100) : 0,
  };
  const netWorthKpi = {
    base_currency: baseCurrency,
    cash_and_bank_normalized: cashAndBankNormalized,
    uninvested_brokerage_cash_normalized: uninvestedBrokerageCashNormalized,
    total_liquid_cash_normalized: totalLiquidCashNormalized,
    invested_assets_market_value_normalized: totalInvestedMarket,
    total_assets_normalized: totalAssetsNormalized,
    total_liabilities_normalized: totalLiabilitiesNormalized,
    total_receivables_normalized: totalReceivablesNormalized,
    net_worth_normalized: netWorthNormalized,
    allocation_pct: allocationPct,
  };

  // Portfolio performance (period realized from trades rows in selected period)
  const periodRealizedByClass = { stock: 0, etf: 0, crypto: 0 } as Record<string, number>;
  let periodTradingFeesTax = 0;
  let periodRealizedTotal = 0;
  for (const t of tradeRows) {
    if (t.realized_pnl_normalized != null) {
      periodRealizedTotal += t.realized_pnl_normalized;
      if (periodRealizedByClass[t.asset_class] != null) periodRealizedByClass[t.asset_class] += t.realized_pnl_normalized;
    }
    const feeTaxNorm = normalizeToBase((t.fee_amount || 0) + (t.stamp_duty || 0), t.settlement_currency, baseCurrency, rates);
    periodTradingFeesTax += feeTaxNorm;
  }
  const portfolioPerformance = {
    base_currency: baseCurrency,
    active_holdings_count: activeHoldingsCount,
    total_cost_basis_normalized: totalCostBasis,
    total_market_value_normalized: totalInvestedMarket,
    total_unrealized_pnl_normalized: totalUnrealized,
    total_unrealized_pnl_pct: totalCostBasis > 0 ? round2((totalUnrealized / totalCostBasis) * 100) : null,
    period_realized_pnl_normalized: round2(periodRealizedTotal),
    period_realized_pnl_by_asset_class: {
      stock: round2(periodRealizedByClass.stock),
      etf: round2(periodRealizedByClass.etf),
      crypto: round2(periodRealizedByClass.crypto),
    },
    period_trading_fees_and_tax_normalized: round2(periodTradingFeesTax),
  };

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
    highlights.push(`Adjusted operating net (excl. investment capital deployments, loan principal, discrepancy, trade-mirrored txs): ${fmtMoney(operatingNet, baseCurrency, lang)} (normalized).`);
    highlights.push(`Net worth snapshot: ${fmtMoney(netWorthNormalized, baseCurrency, lang)} (assets ${fmtMoney(totalAssetsNormalized, baseCurrency, lang)}, liabilities ${fmtMoney(totalLiabilitiesNormalized, baseCurrency, lang)}), invested market ${fmtMoney(totalInvestedMarket, baseCurrency, lang)}.`);
    if (prevMetrics?.available) highlights.push(`Vs previous period (normalized ledger): income Δ ${prevMetrics.income_delta_normalized >= 0 ? "+" : ""}${fmtMoney(prevMetrics.income_delta_normalized, baseCurrency, lang)}, expense Δ ${prevMetrics.expense_delta_normalized >= 0 ? "+" : ""}${fmtMoney(prevMetrics.expense_delta_normalized, baseCurrency, lang)}, net Δ ${prevMetrics.net_delta_normalized >= 0 ? "+" : ""}${fmtMoney(prevMetrics.net_delta_normalized, baseCurrency, lang)}.`);
  }

  const generatedAt = new Date().toISOString();
  const fxRatesStructured = Object.fromEntries(Object.entries(rates).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k, Number(v)]));
  const ts = generatedAt.slice(0, 10);

  const summaryName = `wealth-ai-summary-${ts}.md`;
  const txName = `transactions-${ts}.csv`;
  const trName = `transfers-${ts}.csv`;
  const tradesName = `trades-${ts}.csv`;
  const contextName = `context-${ts}.json`;

  const manifest = {
    schema_version: "pocketly-wealth-1",
    export_type: "ai_wealth_export",
    generated_at: generatedAt,
    timezone: timeZone,
    requested_period: {
      preset: options.preset,
      start_local_inclusive: periodStartDateLocal,
      end_local_inclusive: periodEndDateLocal,
      start_utc_inclusive: rangeStart,
      end_utc_exclusive: rangeEnd,
      resolution: periodResolution,
      note: options.preset === "all" ? "All available records (no date bounds). Comparison and bounded-period day metrics are unavailable by design." : "Bounds are half-open [start_utc_inclusive, end_utc_exclusive) on transaction_date/transfer_date/trade_date timestamps; local dates reflect user timezone intent.",
    },
    actual_data_range_covered: { ...actualDataRange, derived_from: "min/max date_local of included transaction, transfer, and trade rows in this export" },
    base_currency: baseCurrency,
    included_files: [
      { name: summaryName, type: "markdown" as const, rows: null as number | null, always_included: true, description: "manifest, definitions, cashflow & net worth KPIs, holdings summary (from real Pocketly data)" },
      ...(options.includeTransactionsCsv ? [{ name: txName, type: "csv" as const, rows: txRows.length, always_included: false, description: "ledger transactions (income/expense)" }] : []),
      ...(options.includeTransfersCsv ? [{ name: trName, type: "csv" as const, rows: trRows.length, always_included: false, description: "inter-account transfers (separate flow)" }] : []),
      ...(includeTradesCsv ? [{ name: tradesName, type: "csv" as const, rows: tradeRows.length, always_included: false, description: "investment trades from real tables (stock, etf, crypto; buy/sell)" }] : []),
      ...(options.includeContextJson ? [{ name: contextName, type: "json" as const, rows: null as number | null, always_included: false, description: "snapshots (accounts, holdings, debts, budgets, goals), manifest meta, structured rates" }] : []),
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
      holdings_shown_in_summary: holdingsSnap.length,
      holdings_total: holdingsSnap.length,
    },
    read_order: ["wealth-ai-summary-*.md (manifest, definitions, KPIs, highlights)", "transactions-*.csv if included (full ledger detail)", "transfers-*.csv if included (full transfer detail)", "trades-*.csv if included (unified trade detail)", "context-*.json if included (structured snapshots/meta/rates)"],
  };

  const definitions = {
    schema_version: "pocketly-wealth-1",
    glossary: {
      ledger: "Rows from transactions table in the selected period (income/expense), exported as-is for that scope.",
      net_cashflow: "Σ amount_normalized of income transactions − Σ amount_normalized of expense transactions, over ledger transactions only, in base_currency.",
      cashflow_adjusted: "Best-effort operating view derived from real Pocketly data: ledger totals excluding (1) trade-linked mirror transaction rows (stock/crypto/etf trade FKs -> related_trade_ref=<trade_id>), (2) category 'Loan & Debt' (canonical system category) treated as debt/principal movements, and (3) category 'Discrepancy' (canonical system category) treated as balance adjustments. Investment capital movements are also approximated from transfers to/from investment accounts (account.type heuristic, separate non-ledger flow). This is a convenience view, not a guaranteed accounting statement.",
      net_worth: "Snapshot from real app data: total liquid cash (cash/bank/ewallet + uninvested investment-account balances) + invested assets market value (stock/crypto/etf holdings, cached prices with market-or-cost fallback) + receivables − liabilities, normalized to base_currency using USD-base FX and cached asset prices.",
      amount_original: "Original amount in native/settlement currency.",
      amount_normalized: "amount_original converted to base_currency using USD-base FX rates; formula: (amount_original / rate[currency_original_or_USD]) * rate[base_currency]. Rounded to 2 decimals per value.",
      base_currency: "User-selected normalization currency for comparable KPIs.",
      uncategorized: { canonical_key: "__uncategorized__", condition: "category_id is null/empty", display_label_id: "Tanpa Kategori", display_label_en: "Uncategorized" },
      transfer_flow: "Inter-account movement (transfers table). Separate from ledger income/expense and excluded from net_cashflow to avoid double-counting.",
      trade_flow: "Investment trade execution records from real trade tables (stock_trades/crypto_trades/etf_trades, buy/sell only). Fees/stamp duty fields come from actual trade records.",
      exchange_rate: "USD-base map value means 1 USD = rate[currency] units of that currency.",
      related_trade_ref: "Transaction row linked to an investment trade; value is the actual <trade_id> for reconciliation/joins with trades.csv. stock_trade_id/crypto_trade_id/etf_trade_id linkage fields exist in real data.",
      reconciliation_rule: "Anti-double-counting guidance (best-effort): (1) Investment top-up/withdraw via transfers.csv (not operating expense). (2) Trade executions in trades.csv; if mirror rows exist in transactions.csv they carry related_trade_ref=<trade_id> and are excluded from the cashflow_adjusted operating view. (3) Trading fees/stamp duty appear in trades.csv fields and may also be represented in linked ledger rows depending on app behavior; use reconciliation counts/refs when interpreting.",
      rounding_precision: "Monetary normalized amounts rounded to 2 decimals; FX/prices shown as stored numeric values.",
    },
    units: {
      normalized_amounts: `currency = base_currency (${baseCurrency})`,
      original_amounts: "currency = currency_original / settlement_currency / from_currency / to_currency as specified",
      account_balances_snapshot: "native per-account currency (current_balance/initial_balance); not directly summable with normalized KPIs across currencies",
      holdings_snapshot: "original fields in settlement_currency, normalized fields in base_currency",
      budget_snapshot: "native budget currency per row; representative approximation",
    },
    csv_schemas: {
      "transactions.csv": {
        description: "Ledger transactions (income/expense) in period. Read with summary/definitions for semantics.",
        columns: {
          date_iso: "Timestamp/string as stored (transaction_date).",
          date_local: "Local calendar date (YYYY-MM-DD) in export timezone.",
          type: "income|expense (ledger).",
          amount_original: "Original amount in currency_original.",
          currency_original: "Original/native currency code.",
          amount_normalized: `Amount converted to base_currency (${baseCurrency}) using USD-base FX; rounded 2dp.`,
          base_currency: "Normalization target currency.",
          account_name: "Account name.",
          account_currency: "Account native currency.",
          category_key: "Canonical category key (__uncategorized__ when category_id null).",
          category_name_display: "Display/localized category name.",
          description_raw: "Original description text.",
          description_clean: "Cleaned description.",
          tags: "Semicolon-separated tags.",
          items_json: "JSON array of normalized items.",
          transaction_id: "Transaction id.",
          account_id: "Account id.",
          category_id: "Category id or empty.",
          transfer_id_ref: "Linked transfer id if any.",
          related_trade_ref: "Linked trade id (<trade_id>) if any; join key to trades.csv.",
          created_at: "Record creation timestamp.",
        },
      },
      "transfers.csv": {
        description: "Inter-account transfers (separate flow, excluded from ledger net_cashflow).",
        columns: {
          date_iso: "Timestamp/string as stored (transfer_date).",
          date_local: "Local calendar date (YYYY-MM-DD) in export timezone.",
          from_account: "Source account name.",
          to_account: "Destination account name.",
          amount_original: "Transfer amount in from_currency.",
          from_currency: "Source currency.",
          to_currency: "Destination currency.",
          amount_normalized_from: `amount_original converted to base_currency (${baseCurrency}).`,
          base_currency: "Normalization target currency.",
          exchange_rate_stored: "Stored transfer exchange rate (pair-specific).",
          fee_amount_original: "Fee amount in from_currency basis or empty.",
          fee_currency_basis: "Currency basis for fee normalization (from_currency).",
          fee_mode: "Recorded fee mode.",
          net_amount_stored: "Stored net amount.",
          fee_normalized_base: "Fee normalized to base_currency.",
          description: "Transfer description.",
          transfer_id: "Transfer id.",
        },
      },
      "trades.csv": {
        description: "Investment trades from real Pocketly tables (stock_trades, etf_trades, crypto_trades) for the period. Asset classes: stock/etf/crypto; types: buy/sell only.",
        columns: {
          trade_id: "Trade id (matches transactions.related_trade_ref / stock_trade_id / crypto_trade_id / etf_trade_id when linked).",
          date_iso: "Trade timestamp as stored (trade_date).",
          date_local: "Local calendar date (YYYY-MM-DD) in export timezone.",
          asset_class: "stock | etf | crypto.",
          symbol: "Ticker/symbol from the actual trade record.",
          type: "buy | sell.",
          account_name: "Account name.",
          quantity: "Quantity/units/shares from trade data (stock derived from shares/lots when needed).",
          lots: "Lots for stock trades when available, otherwise null.",
          price_per_unit: "Price per unit/share from trade data (or derived when stored differently).",
          settlement_currency: "Settlement currency from trade/account data.",
          gross_amount: "Gross amount from/derived for the trade in settlement currency.",
          fee_amount: "Fee amount in settlement currency (0 for stock trades where no separate fee field is stored).",
          stamp_duty: "Stamp duty in settlement currency (stock trades; 0 otherwise).",
          net_amount_original: "Best-effort cash effect in settlement currency derived from real trade fields (see assumptions).",
          net_amount_normalized: "net_amount_original converted to base_currency.",
          base_currency: "Normalization target currency.",
          cost_basis_sold: "Cost basis for sell trades when available (null for buys).",
          realized_pnl_normalized: "Realized P&L for sell trades normalized to base_currency when available (null for buys).",
          notes: "Trade notes.",
        },
      },
    },
    assumptions: {
      trade_cash_effect: "net_amount_original is a best-effort cash-effect approximation derived from real trade fields: stock buy ≈ net_amount+stamp_duty, stock sell ≈ net_amount-stamp_duty; crypto/etf buy ≈ gross_amount+fee_amount, sell ≈ gross_amount-fee_amount. Gross/fee/stamp_duty/realized fields reflect actual stored/derived trade data where available.",
      holdings_valuation: "Holdings market values prefer cached asset_prices converted via USD-base rates; if no cached price or invalid quantity, market_value falls back to cost basis (valuation_source indicates fallback).",
      cashflow_adjusted: cashflowAdjusted.basis,
      supported_investment_data: "Real app investment data only: stock, etf, crypto holdings/trades (buy/sell). No mutual fund or dividend/staking reward records.",
    },
  };

  const kpi = {
    schema_version: "pocketly-wealth-1",
    meta: {
      formulas: {
        net_cashflow_normalized: "sum(income amount_normalized) - sum(expense amount_normalized) over ledger transactions only",
        amount_normalized: "(amount_original / usd_base_rate[currency_original]) * usd_base_rate[base_currency], rounded to 2 decimals",
        net_worth_normalized: "total_assets_normalized - total_liabilities_normalized",
      },
      denominators: {
        share_pct_of_type: "total income_normalized or expense_normalized for the same transaction type",
        per_day_metrics: "calendar days in bounded period (user timezone) when available",
        operating_savings_rate_pct: "operating_net_surplus_normalized / operating_income_normalized",
      },
      unavailable_metric_convention: "value null with available=false and reason string when metric is not meaningful/applicable",
      cashflow_adjusted_note: "cashflow_adjusted is a best-effort operating view (heuristics from canonical categories, trade links, and investment-account transfers), not a guaranteed/spec-defined accounting classification.",
    },
    period: { ...manifest.requested_period, days_in_period: perDayDenom ? metricWithMeta(perDayDenom, true, null) : metricWithMeta<number | null>(null, false, options.preset === "all" ? "unbounded_period_all" : "no_bounded_period") },
    ledger: ledger,
    cashflow_adjusted: cashflowAdjusted,
    net_worth: netWorthKpi,
    portfolio_performance: portfolioPerformance,
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
        ? "monthly_local if bounded period > 120 calendar days, else daily_local; buckets are sparse/observed local periods with >=1 ledger transaction"
        : "daily_local for unbounded/all period (observed sparse local dates with >=1 ledger transaction)",
      all_period_note: options.preset === "all" ? "Unbounded/all period: trend shows observed daily_local activity only." : null,
    } : undefined,
    transfers_non_ledger: {
      transfer_count: trRows.length,
      total_sent_amount_normalized_from_currency: { value: transferAmountNormalizedTotal, currency: baseCurrency, basis: "sum of amount_original converted from from_currency to base_currency" },
      total_fee_normalized: { value: transferFeeNormalizedTotal, currency: baseCurrency, basis: "sum of fee_amount converted from from_currency basis to base_currency" },
      transfers_with_fee_count: transferFeeCount,
      note: "Transfers are inter-account flows, excluded from ledger income/expense/net_cashflow.",
      reconciliation_rule: "Do NOT add total_fee_normalized to ledger expense/net_cashflow without deduping via transfer_id_ref.",
    },
    reconciliation: {
      transactions_linked_to_transfer: linkedToTransferCount,
      transactions_linked_to_trade: linkedToTradeCount,
      trades_in_period: tradeRows.length,
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

  // ---- Build summary markdown (aligned to real Pocketly data) ----
  const lines: string[] = [];
  lines.push(`# Pocketly — AI Wealth Export`);
  lines.push(``);
  lines.push(`## How to read / Manifest`);
  lines.push(`- schema_version: ${manifest.schema_version} | export_type: ${manifest.export_type} | generated_at: ${generatedAt}`);
  lines.push(`- data source: real Pocketly records (accounts, ledger transactions/transfers, stock/crypto/etf holdings & buy/sell trades, cached FX/prices, debts/budgets/goals snapshots where available)`);
  lines.push(`- timezone: ${timeZone}`);
  lines.push(`- requested period: preset=${options.preset}, local=${periodStartDateLocal || "null"}..${periodEndDateLocal || "null"} (inclusive), utc=[${rangeStart || "null"}, ${rangeEnd || "null"}) half-open | resolution=${periodResolution}`);
  if (options.preset === "all") lines.push(`- preset "all": no date bounds (unbounded); actual_data_range_covered shows min/max local dates of returned rows.`);
  lines.push(`- actual data range covered (local dates): ${actualDataRange.start_local || "n/a"} .. ${actualDataRange.end_local || "n/a"} (has_data=${actualDataRange.has_data})`);
  lines.push(`- base_currency (normalized): ${baseCurrency}`);
  lines.push(`- read order: ${manifest.read_order.join(" -> ")}`);
  lines.push(`- included files:`);
  for (const f of manifest.included_files) lines.push(`  - ${f.name} (${f.type}${f.rows != null ? `, rows=${f.rows}` : ""}${f.description ? `, ${f.description}` : ""})`);
  lines.push(``);

  lines.push(`## Definitions / Glossary (concise)`);
  lines.push(`- ledger net_cashflow_normalized = Σ income_normalized − Σ expense_normalized in ${baseCurrency} (ledger only).`);
  lines.push(`- cashflow_adjusted is a best-effort operating view (not guaranteed): excludes trade-linked mirror tx rows (related_trade_ref=<trade_id>), canonical 'Loan & Debt' principal movements, and canonical 'Discrepancy' adjustments from ledger totals; investment capital movements are heuristically reported from transfers to/from investment accounts.`);
  lines.push(`- amount_normalized: (amount_original / rate[from]) * rate[base], rounded 2dp. FX source=${fxSource}${fxFetchedAt ? `, fetched_at=${fxFetchedAt}` : ""}.`);
  lines.push(`- reconciliation (best-effort): transfers are separate from ledger; trade executions/fees/tax come from real trade records; linked mirror tx rows can be identified by related_trade_ref/trade FKs and are excluded from the adjusted operating view to reduce double-counting.`);
  lines.push(``);

  lines.push(`## Executive Summary (${baseCurrency}, normalized)`);
  lines.push(`- Ledger: income ${fmtMoney(ledger.income_normalized, baseCurrency, lang)} | expense ${fmtMoney(ledger.expense_normalized, baseCurrency, lang)} | net ${fmtMoney(ledger.net_cashflow_normalized, baseCurrency, lang)} | tx ${ledger.tx_count_ledger}`);
  lines.push(`- Adjusted operating: income ${fmtMoney(operatingIncome, baseCurrency, lang)} | expense ${fmtMoney(operatingExpense, baseCurrency, lang)} | net ${fmtMoney(operatingNet, baseCurrency, lang)} | savings rate ${operatingSavingsRate == null ? "n/a" : fmtNum(operatingSavingsRate, lang) + "%"}`);
  lines.push(`- Net worth: ${fmtMoney(netWorthNormalized, baseCurrency, lang)} (assets ${fmtMoney(totalAssetsNormalized, baseCurrency, lang)}, liabilities ${fmtMoney(totalLiabilitiesNormalized, baseCurrency, lang)}, receivables ${fmtMoney(totalReceivablesNormalized, baseCurrency, lang)}) | liquid cash ${fmtMoney(totalLiquidCashNormalized, baseCurrency, lang)} | invested market ${fmtMoney(totalInvestedMarket, baseCurrency, lang)}`);
  lines.push(`- Portfolio (period): realized P&L ${fmtMoney(portfolioPerformance.period_realized_pnl_normalized, baseCurrency, lang)} | fees+tax ${fmtMoney(portfolioPerformance.period_trading_fees_and_tax_normalized, baseCurrency, lang)} | unrealized ${fmtMoney(totalUnrealized, baseCurrency, lang)} (${portfolioPerformance.total_unrealized_pnl_pct == null ? "n/a" : fmtNum(portfolioPerformance.total_unrealized_pnl_pct, lang) + "%"})`);
  lines.push(`- Transfers (separate): ${trRows.length} transfers, sent ${fmtMoney(transferAmountNormalizedTotal, baseCurrency, lang)}, fees ${fmtMoney(transferFeeNormalizedTotal, baseCurrency, lang)}. Trades in period: ${tradeRows.length}.`);
  if (highlights.length) for (const h of highlights.slice(0, compact ? 4 : 6)) lines.push(`- ${h}`);
  lines.push(``);

  if (!compact) {
    lines.push(`## FX & Normalization (reproducible)`);
    lines.push(`- base_currency: ${baseCurrency} | source: ${fxSource}${fxFetchedAt ? ` | fetched_at: ${fxFetchedAt}` : ""} | fallback_defaults_used: ${fxSource.startsWith("fallback")}`);
    lines.push(`- policy: USD-base rate map (1 USD = rate[currency]). amount_normalized = (amount_original / rate[from]) * rate[${baseCurrency}], rounded 2dp.`);
    lines.push(`- rates (USD base): ${Object.entries(fxRatesStructured).map(([k,v])=>`${k}=${v}`).join(", ")}`);
    lines.push(``);
  }

  lines.push(`## KPI (self-describing, machine-readable)`);
  lines.push("```json");
  lines.push(JSON.stringify(kpi, null, 2));
  lines.push("```");
  lines.push(``);

  lines.push(`## Definitions (machine-readable, includes glossary/units/csv_schemas/assumptions)`);
  lines.push("```json");
  lines.push(JSON.stringify(definitions, null, 2));
  lines.push("```");
  lines.push(``);

  if (options.metrics.trend && trend.length) {
    lines.push(`## Trend (${trendGranularity}, local buckets, sparse/observed)`);
    lines.push(`| Bucket (local) | Income (Normalized, ${baseCurrency}) | Expense (Normalized, ${baseCurrency}) | Net Cashflow (Normalized, ${baseCurrency}) | Tx Count (ledger) |`);
    lines.push(`|---|---:|---:|---:|---:|`);
    for (const t of trend) lines.push(`| ${t.bucket} | ${fmtNum(t.income_normalized,lang)} | ${fmtNum(t.expense_normalized,lang)} | ${fmtNum(t.net_cashflow_normalized,lang)} | ${t.tx_count_ledger} |`);
    lines.push(``);
  }

  if (options.metrics.breakdowns && !compact) {
    lines.push(`## Breakdown (ledger, normalized to ${baseCurrency})`);
    lines.push(``);
    lines.push(`### Categories (top ${Math.min(byCategory.length, 20)} of ${byCategory.length})`);
    lines.push(`| Category (display) | Category key | Type | Amount (Normalized) | Share % of type | Tx Count |`);
    lines.push(`|---|---|---|---:|---:|---:|`);
    for (const c of byCategory.slice(0, 20)) lines.push(`| ${c.category} | ${c.category_key} | ${c.type} | ${fmtNum(c.amount_normalized,lang)} | ${fmtMaybeNum(c.share_pct_of_type,lang)} | ${c.tx_count} |`);
    lines.push(``);
  }

  if (options.metrics.topTransactions) {
    lines.push(`## Top Transactions (ledger, evidence)`);
    lines.push(`### Top Expenses`);
    lines.push(`| Date (local) | Amount (Original) | Cur | Amount (Normalized) | Category | Account | Description | related_trade_ref |`);
    lines.push(`|---|---:|---|---:|---|---|---|---|`);
    for (const r of topExpenseTx) lines.push(`| ${r.date_local} | ${fmtNum(r.amount_original,lang)} | ${r.currency_original} | ${fmtNum(r.amount_normalized,lang)} | ${r.category_name_display} | ${r.account_name} | ${(r.description_clean||r.description_raw).replace(/\|/g,"/").slice(0,80)} | ${r.related_trade_ref || ""} |`);
    lines.push(``);
  }

  lines.push(`## Transfers — Inter-account Flow (SEPARATE, not in ledger net_cashflow)`);
  lines.push(`- count=${trRows.length}, sent normalized ${fmtMoney(transferAmountNormalizedTotal, baseCurrency, lang)}, fees normalized ${fmtMoney(transferFeeNormalizedTotal, baseCurrency, lang)}.`);
  if (trRows.length) {
    lines.push(``);
    lines.push(`| Date (local) | From | To | Amount (Original) | From Cur | To Cur | Amount (Normalized, ${baseCurrency}) | Fee Norm | Description |`);
    lines.push(`|---|---|---|---:|---|---|---:|---:|---|`);
    for (const t of trRows.slice(0, 50)) lines.push(`| ${t.date_local} | ${t.from_account} | ${t.to_account} | ${fmtNum(t.amount_original,lang)} | ${t.from_currency} | ${t.to_currency} | ${fmtNum(t.amount_normalized_from,lang)} | ${t.fee_normalized_base ?? ""} | ${(t.description||"").replace(/\|/g,"/").slice(0,60)} |`);
    if (trRows.length > 50) lines.push(`\n_(showing 50 of ${trRows.length} transfers in summary; see transfers.csv for full list)_`);
  } else {
    lines.push(`- (no transfers in period)`);
  }
  lines.push(``);

  // --- Wealth / investment sections ---
  lines.push(`## Balance Sheet & Net Worth Snapshot (${baseCurrency}, normalized)`);
  lines.push(`- **Total Liquid Cash:** ${fmtMoney(totalLiquidCashNormalized, baseCurrency, lang)} (Bank/Cash/E-wallet: ${fmtMoney(cashAndBankNormalized, baseCurrency, lang)} | Uninvested Investment-account Cash: ${fmtMoney(uninvestedBrokerageCashNormalized, baseCurrency, lang)})`);
  lines.push(`- **Invested Assets (Market Value):** ${fmtMoney(totalInvestedMarket, baseCurrency, lang)} (Cost Basis: ${fmtMoney(totalCostBasis, baseCurrency, lang)} | Unrealized P&L: ${fmtMoney(totalUnrealized, baseCurrency, lang)} / ${portfolioPerformance.total_unrealized_pnl_pct == null ? "n/a" : fmtNum(portfolioPerformance.total_unrealized_pnl_pct, lang) + "%"})`);
  lines.push(`- **Total Liabilities:** ${fmtMoney(totalLiabilitiesNormalized, baseCurrency, lang)}`);
  lines.push(`- **Total Net Worth:** ${fmtMoney(netWorthNormalized, baseCurrency, lang)}`);
  lines.push(``);
  lines.push(`| Asset Class | Market Value (${baseCurrency}) | Cost Basis (${baseCurrency}) | Unrealized P&L (${baseCurrency}) | Allocation (%) |`);
  lines.push(`|---|---:|---:|---:|---:|`);
  const cbNorm = cashAndBankNormalized; // cost/value same for cash
  const ubNorm = uninvestedBrokerageCashNormalized;
  lines.push(`| Cash & Bank | ${fmtNum(cbNorm, lang)} | ${fmtNum(cbNorm, lang)} | ${fmtNum(0, lang)} | ${fmtNum(allocationPct.cash_and_bank, lang)}% |`);
  lines.push(`| Uninvested Investment-account Cash | ${fmtNum(ubNorm, lang)} | ${fmtNum(ubNorm, lang)} | ${fmtNum(0, lang)} | ${fmtNum(allocationPct.uninvested_brokerage_cash, lang)}% |`);
  const cryptoUnreal = round2(investedMarketByClass.crypto - costByClass.crypto);
  const stockUnreal = round2(investedMarketByClass.stock - costByClass.stock);
  const etfUnreal = round2(investedMarketByClass.etf - costByClass.etf);
  lines.push(`| Crypto | ${fmtNum(round2(investedMarketByClass.crypto), lang)} | ${fmtNum(round2(costByClass.crypto), lang)} | ${fmtNum(cryptoUnreal, lang)} | ${fmtNum(allocationPct.crypto, lang)}% |`);
  lines.push(`| Stock | ${fmtNum(round2(investedMarketByClass.stock), lang)} | ${fmtNum(round2(costByClass.stock), lang)} | ${fmtNum(stockUnreal, lang)} | ${fmtNum(allocationPct.stock, lang)}% |`);
  lines.push(`| ETF | ${fmtNum(round2(investedMarketByClass.etf), lang)} | ${fmtNum(round2(costByClass.etf), lang)} | ${fmtNum(etfUnreal, lang)} | ${fmtNum(allocationPct.etf, lang)}% |`);
  lines.push(`| **Total Assets** | **${fmtNum(totalAssetsNormalized, lang)}** | **${fmtNum(round2(cbNorm + ubNorm + totalCostBasis), lang)}** | **${fmtNum(totalUnrealized, lang)}** | **100.00%** |`);
  lines.push(``);

  lines.push(`## Active Holdings Snapshot`);
  if (holdingsSnap.length) {
    lines.push(``);
    lines.push(`| Asset Class | Symbol | Account | Quantity | Avg Buy (${baseCurrency} orig/settlement) | Market Price (orig) | Market Value (${baseCurrency}) | Unrealized P&L (${baseCurrency}) | Unrealized (%) |`);
    lines.push(`|---|---|---|---:|---:|---:|---:|---:|---:|`);
    for (const h of holdingsSnap) {
      lines.push(`| ${h.asset_class} | ${h.symbol} | ${h.account_name} | ${h.quantity} | ${fmtNum(Number(h.average_buy_price_original)||0, lang)} ${h.settlement_currency} | ${h.market_price_original == null ? "n/a" : fmtNum(Number(h.market_price_original), lang)} ${h.settlement_currency} | ${fmtNum(Number(h.market_value_normalized)||0, lang)} | ${fmtNum(Number(h.unrealized_pnl_normalized)||0, lang)} | ${h.unrealized_pnl_pct == null ? "n/a" : fmtNum(Number(h.unrealized_pnl_pct), lang)+"%"} |`);
    }
  } else {
    lines.push(`- (no holdings)`);
  }
  lines.push(``);

  // Investment Realized P&L Summary (Period)
  const tradeAgg = (cls: string) => {
    const rows = tradeRows.filter((t) => t.asset_class === cls);
    let buyVol = 0, sellVol = 0, feesTax = 0, realized = 0;
    for (const t of rows) {
      const grossNorm = normalizeToBase(t.gross_amount, t.settlement_currency, baseCurrency, rates);
      const feeTaxNorm = normalizeToBase((t.fee_amount || 0) + (t.stamp_duty || 0), t.settlement_currency, baseCurrency, rates);
      if (t.type === "buy") buyVol += grossNorm; else if (t.type === "sell") sellVol += grossNorm;
      feesTax += feeTaxNorm;
      if (t.realized_pnl_normalized != null) realized += t.realized_pnl_normalized;
    }
    return { buyVol: round2(buyVol), sellVol: round2(sellVol), feesTax: round2(feesTax), realized: round2(realized), count: rows.length };
  };
  const sAgg = tradeAgg("stock"), cAgg = tradeAgg("crypto"), eAgg = tradeAgg("etf");
  const tAgg = {
    buyVol: round2(sAgg.buyVol + cAgg.buyVol + eAgg.buyVol),
    sellVol: round2(sAgg.sellVol + cAgg.sellVol + eAgg.sellVol),
    feesTax: round2(sAgg.feesTax + cAgg.feesTax + eAgg.feesTax),
    realized: round2(sAgg.realized + cAgg.realized + eAgg.realized),
    count: sAgg.count + cAgg.count + eAgg.count,
  };
  lines.push(`## Investment Realized P&L Summary (Period)`);
  lines.push(``);
  lines.push(`| Asset Class | Buy Volume (${baseCurrency}) | Sell Volume (${baseCurrency}) | Fees & Stamp Duty (${baseCurrency}) | Realized P&L (${baseCurrency}) | Trade Count |`);
  lines.push(`|---|---:|---:|---:|---:|---:|`);
  lines.push(`| stock | ${fmtNum(sAgg.buyVol, lang)} | ${fmtNum(sAgg.sellVol, lang)} | ${fmtNum(sAgg.feesTax, lang)} | ${fmtNum(sAgg.realized, lang)} | ${sAgg.count} |`);
  lines.push(`| etf | ${fmtNum(eAgg.buyVol, lang)} | ${fmtNum(eAgg.sellVol, lang)} | ${fmtNum(eAgg.feesTax, lang)} | ${fmtNum(eAgg.realized, lang)} | ${eAgg.count} |`);
  lines.push(`| crypto | ${fmtNum(cAgg.buyVol, lang)} | ${fmtNum(cAgg.sellVol, lang)} | ${fmtNum(cAgg.feesTax, lang)} | ${fmtNum(cAgg.realized, lang)} | ${cAgg.count} |`);
  lines.push(`| **Total** | **${fmtNum(tAgg.buyVol, lang)}** | **${fmtNum(tAgg.sellVol, lang)}** | **${fmtNum(tAgg.feesTax, lang)}** | **${fmtNum(tAgg.realized, lang)}** | **${tAgg.count}** |`);
  lines.push(``);

  if (!compact) {
    lines.push(`## Context Snapshots (non-ledger, caveated)`);
    lines.push(`### Accounts snapshot`);
    if (accountsSnapRaw.length) {
      lines.push(`| Account | Type | Currency | Current Balance | Active |`);
      lines.push(`|---|---|---|---:|---|`);
      for (const a of accountsSnapRaw) lines.push(`| ${a.name || ""} | ${a.type || ""} | ${a.currency || ""} | ${fmtNum(Number(a.current_balance)||0, lang)} | ${a.is_active ? "yes" : "no"} |`);
    } else lines.push(`- (no accounts)`);
    lines.push(``);
    lines.push(`### Debts snapshot (active)`);
    if (debtsSnap.length) {
      lines.push(`| Counterparty | Type | Remaining (orig) | Currency | Remaining (${baseCurrency}) | Status | Due |`);
      lines.push(`|---|---|---:|---|---:|---|---|`);
      for (const d of debtsSnap) lines.push(`| ${d.counterparty || ""} | ${d.type} | ${fmtNum(Number(d.remaining_amount_original)||0, lang)} | ${d.currency} | ${fmtNum(Number(d.remaining_normalized)||0, lang)} | ${d.status} | ${d.due_date || ""} |`);
    } else lines.push(`- (none)`);
    lines.push(``);
    lines.push(`### Budget snapshot (representative, non-period-aligned approximation)`);
    lines.push(`- caveat: ${JSON.stringify(budgetCaveat)}`);
    if (budgetsSnap.length) {
      lines.push(`| Category | Period Start | Limit (native) | Spent (native) | Remaining (native) | Currency |`);
      lines.push(`|---|---|---:|---:|---:|---|`);
      for (const b of budgetsSnap) lines.push(`| ${b.category} | ${b.period_start} | ${fmtNum(b.limit_native, lang)} | ${fmtNum(b.spent_native, lang)} | ${fmtNum(b.remaining_native, lang)} | ${b.currency} |`);
    } else lines.push(`- (no budget snapshot)`);
    lines.push(``);
  }

  lines.push(`## Data Quality & Notes`);
  lines.push(`- Exported: transactions=${txRows.length}, transfers=${trRows.length}, trades=${tradeRows.length}. linked_to_transfer=${linkedToTransferCount}, linked_to_trade=${linkedToTradeCount}.`);
  lines.push(`- FX: source=${fxSource}${fxFetchedAt ? `, fetched_at=${fxFetchedAt}` : ""}, base=${baseCurrency}. Holdings use cached asset prices with market-or-cost fallback.`);
  lines.push(`- Cashflow adjusted is best-effort: trade-mirrored txs excluded; loan principal identified by category 'Loan & Debt'; discrepancy by category 'Discrepancy'; investment capital deployments derived from transfers to/from investment accounts.`);
  lines.push(``);

  lines.push(`## Machine-readable block (manifest + kpi + definitions)`);
  lines.push("```json");
  lines.push(JSON.stringify({ manifest, kpi, definitions }, null, 2));
  lines.push("```");

  const summaryMd = lines.join("\n");

  // CSV builders
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
  const tradesCsvHeader = "trade_id,date_iso,date_local,asset_class,symbol,type,account_name,quantity,lots,price_per_unit,settlement_currency,gross_amount,fee_amount,stamp_duty,net_amount_original,net_amount_normalized,base_currency,cost_basis_sold,realized_pnl_normalized,notes\n";
  let tradesCsv = tradesCsvHeader;
  for (const t of tradeRows) {
    tradesCsv += [
      t.trade_id, t.date_iso, t.date_local, t.asset_class, csvCell(t.symbol), t.type, csvCell(t.account_name),
      t.quantity, t.lots ?? "", t.price_per_unit, t.settlement_currency, t.gross_amount, t.fee_amount, t.stamp_duty,
      t.net_amount_original, t.net_amount_normalized, t.base_currency, t.cost_basis_sold ?? "", t.realized_pnl_normalized ?? "", csvCell(t.notes),
    ].join(",") + "\n";
  }

  const contextJson = JSON.stringify({
    schema_version: "pocketly-wealth-1",
    manifest,
    kpi,
    definitions,
    snapshots: {
      accounts: accountsSnapRaw,
      holdings: holdingsSnap,
      debts: debtsSnap,
      budgets: budgetsSnap,
      goals: goalsSnap,
      budget_caveat: budgetCaveat,
    },
    fx: kpi.fx,
  }, null, 2);

  const files: { name: string; content: string }[] = [{ name: summaryName, content: summaryMd }];
  if (options.includeTransactionsCsv) files.push({ name: txName, content: txCsv });
  if (options.includeTransfersCsv) files.push({ name: trName, content: trCsv });
  if (includeTradesCsv) files.push({ name: tradesName, content: tradesCsv });
  if (options.includeContextJson) files.push({ name: contextName, content: contextJson });

  if (files.length === 1) {
    return { filename: summaryName, mime: "text/markdown", content: summaryMd, encoding: "utf-8" };
  }

  const zip = new JSZip();
  const folderName = `pocketly-ai-wealth-export-${ts}`;
  const folder = zip.folder(folderName);
  if (!folder) throw new Error("Failed to create export bundle");
  for (const f of files) folder.file(f.name, f.content);
  const b64 = await zip.generateAsync({ type: "base64" });
  return { filename: `${folderName}.zip`, mime: "application/zip", content: b64, encoding: "base64" };
}
