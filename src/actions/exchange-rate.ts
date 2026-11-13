"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  convertAmount,
  ForexRatesMap,
  DEFAULT_FALLBACK_RATES,
} from "@/lib/utils/currency";
import { CurrencyCode } from "@/lib/constants/currencies";

export async function fetchAndSaveForexRates(): Promise<ForexRatesMap> {
  const supabase = await createServerSupabaseClient();

  const res = await fetch("https://open.er-api.com/v6/latest/USD", {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Gagal mengambil kurs (HTTP ${res.status})`);

  const data = await res.json();
  const idr = Number(data?.rates?.IDR);
  const sgd = Number(data?.rates?.SGD);
  if (!idr || !sgd) throw new Error("Data kurs dari API tidak valid");

  const now = new Date().toISOString();
  const { error } = await supabase.from("exchange_rates").insert([
    {
      base_currency: "USD",
      target_currency: "IDR",
      rate: idr,
      fetched_at: now,
    },
    {
      base_currency: "USD",
      target_currency: "SGD",
      rate: sgd,
      fetched_at: now,
    },
  ]);
  if (error) throw new Error(`Gagal menyimpan kurs: ${error.message}`);

  revalidatePath("/", "layout");
  return { USD: 1, IDR: idr, SGD: sgd };
}

export async function getLatestForexRates(): Promise<ForexRatesMap> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.from("exchange_rates")
    .select("target_currency, rate, fetched_at")
    .eq("base_currency", "USD")
    .order("fetched_at", { ascending: false })
    .limit(50);

  const rates: ForexRatesMap = { ...DEFAULT_FALLBACK_RATES };
  const seen = new Set<string>();

  // Urut terbaru -> terlama; baris pertama per mata uang yang menang
  for (const r of (data ?? [])) {
    if (!r.target_currency || !r.rate || seen.has(r.target_currency)) continue;
    seen.add(r.target_currency);
    rates[r.target_currency] = Number(r.rate);
  }

  return rates;
}

export async function getLatestExchangeRate(
  base = "USD",
  target = "IDR",
): Promise<number> {
  const rates = await getLatestForexRates();
  if (base === "USD") {
    return rates[target] || DEFAULT_FALLBACK_RATES[target] || 1;
  }
  return convertAmount(1, base, target, rates);
}

import { computeNetWorthForUser, type NetWorthBreakdownItem } from "@/lib/net-worth/compute";
import { getAssetPrices } from "@/lib/net-worth/prices";

export interface NetWorthSummary {
  totalAccountsIdr: number;
  totalStockHoldingsIdr: number;
  totalCryptoHoldingsIdr: number;
  totalEtfHoldingsIdr: number;
  totalReceivablesIdr: number;
  totalSavingsGoalsIdr: number;
  totalDebtsIdr: number;
  netWorthIdr: number;
  exchangeRate: number;
  rates: ForexRatesMap;
  latestPriceFetchedAt: string | null;
  accounts: NetWorthBreakdownItem[];
  stocks: NetWorthBreakdownItem[];
  crypto: NetWorthBreakdownItem[];
  etf: NetWorthBreakdownItem[];
  receivables: NetWorthBreakdownItem[];
  debts: NetWorthBreakdownItem[];
  goals: NetWorthBreakdownItem[];
}

export interface NetWorthSnapshotPoint {
  date: string;
  netWorthIdr: number;
  assetsIdr: number;
  liabilitiesIdr: number;
  rates: ForexRatesMap;
}

export async function getNetWorthData(
  // Kept for backward compat; computation is always in IDR (canonical),
  // the view converts to the user's preferred display currency.
  _displayCurrency: CurrencyCode = "IDR",
): Promise<NetWorthSummary> {
  void _displayCurrency;
  const supabase = await createServerSupabaseClient();
  const rates = await getLatestForexRates();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      totalAccountsIdr: 0,
      totalStockHoldingsIdr: 0,
      totalCryptoHoldingsIdr: 0,
      totalEtfHoldingsIdr: 0,
      totalReceivablesIdr: 0,
      totalSavingsGoalsIdr: 0,
      totalDebtsIdr: 0,
      netWorthIdr: 0,
      exchangeRate: rates.IDR || 16200,
      rates,
      latestPriceFetchedAt: null,
      accounts: [],
      stocks: [],
      crypto: [],
      etf: [],
      receivables: [],
      debts: [],
      goals: [],
    };
  }

  const prices = await getAssetPrices(
    supabase as unknown as Parameters<typeof getAssetPrices>[0],
  );
  const latestPriceFetchedAt = Array.from(prices.values()).reduce<
    string | null
  >(
    (latest, p) =>
      !latest || p.fetchedAt > latest ? p.fetchedAt : latest,
    null,
  );
  const c = await computeNetWorthForUser(
    supabase as unknown as Parameters<typeof computeNetWorthForUser>[0],
    user.id,
    rates,
    prices,
  );

  return {
    totalAccountsIdr: c.totalAccountsIdr,
    // Stock only — crypto & ETF have their own fields below.
    // (Previously this was stock+crypto+ETF combined, which double-counted
    // crypto/ETF when the view summed all three separately.)
    totalStockHoldingsIdr: c.totalStockHoldingsIdr,
    totalCryptoHoldingsIdr: c.totalCryptoHoldingsIdr,
    totalEtfHoldingsIdr: c.totalEtfHoldingsIdr,
    totalReceivablesIdr: c.totalReceivablesIdr,
    totalSavingsGoalsIdr: c.totalSavingsGoalsIdr,
    totalDebtsIdr: c.totalDebtsIdr,
    netWorthIdr: c.netWorthIdr,
    exchangeRate: rates.IDR || 16200,
    rates,
    latestPriceFetchedAt,
    accounts: c.accounts,
    stocks: c.stocks,
    crypto: c.crypto,
    etf: c.etf,
    receivables: c.receivables,
    debts: c.debts,
    goals: c.goals,
  };
}

export async function getNetWorthSnapshots(): Promise<NetWorthSnapshotPoint[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await (supabase as unknown as { from: (table: "net_worth_snapshots") => { select: (q: string) => { order: (c: string, o: { ascending: boolean }) => { limit: (n: number) => Promise<{ data: Array<Record<string, unknown>> | null; error: unknown }> } } } }).from("net_worth_snapshots")
    .select("snapshot_date, net_worth_idr, total_assets_idr, total_liabilities_idr, rates")
    .order("snapshot_date", { ascending: true })
    .limit(730);

  if (error || !data) return [];
  return (data as Array<Record<string, unknown>>).map((r) => ({
    date: String(r.snapshot_date).substring(0, 10),
    netWorthIdr: Number(r.net_worth_idr) || 0,
    assetsIdr: Number(r.total_assets_idr) || 0,
    liabilitiesIdr: Number(r.total_liabilities_idr) || 0,
    rates: (r.rates as ForexRatesMap) || { USD: 1, IDR: 16200, SGD: 1.35 },
  }));
}
