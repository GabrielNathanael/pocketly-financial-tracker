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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("exchange_rates") as any).insert([
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.from("exchange_rates") as any)
    .select("target_currency, rate, fetched_at")
    .eq("base_currency", "USD")
    .order("fetched_at", { ascending: false })
    .limit(50);

  const rates: ForexRatesMap = { ...DEFAULT_FALLBACK_RATES };
  const seen = new Set<string>();

  // Urut terbaru -> terlama; baris pertama per mata uang yang menang
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (data ?? []) as any[]) {
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

export interface NetWorthSummary {
  totalAccountsIdr: number;
  totalStockHoldingsIdr: number;
  totalReceivablesIdr: number;
  totalSavingsGoalsIdr: number;
  totalDebtsIdr: number;
  netWorthIdr: number;
  exchangeRate: number;
  rates: ForexRatesMap;
}

export async function getNetWorthData(
  displayCurrency: CurrencyCode = "IDR",
): Promise<NetWorthSummary> {
  const supabase = await createServerSupabaseClient();
  const rates = await getLatestForexRates();

  // 1. Accounts
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: accounts } = await (supabase.from("accounts") as any)
    .select("current_balance, currency, is_active")
    .eq("is_active", true);

  let totalAccountsIdr = 0;
  if (accounts) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const acc of accounts as any[]) {
      totalAccountsIdr += convertAmount(
        Number(acc.current_balance),
        acc.currency,
        displayCurrency,
        rates,
      );
    }
  }

  // 2. Stock Holdings
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: stockHoldings } = await (supabase.from("stock_holdings") as any)
    .select("total_cost, account:accounts(currency)")
    .gt("total_cost", 0);

  let totalStockHoldingsIdr = 0;
  if (stockHoldings) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const h of stockHoldings as any[]) {
      const cur = h.account?.currency || "IDR";
      totalStockHoldingsIdr += convertAmount(
        Number(h.total_cost),
        cur,
        displayCurrency,
        rates,
      );
    }
  }

  // 3. Debts & Receivables
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: debts } = await (supabase.from("debts") as any)
    .select("type, remaining_amount, currency, status")
    .eq("status", "active");

  let totalReceivablesIdr = 0;
  let totalDebtsIdr = 0;

  if (debts) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const d of debts as any[]) {
      const converted = convertAmount(
        Number(d.remaining_amount),
        d.currency,
        displayCurrency,
        rates,
      );
      if (d.type === "receivable") {
        totalReceivablesIdr += converted;
      } else {
        totalDebtsIdr += converted;
      }
    }
  }

  // 4. Savings Goals (Disimpan / Terkumpul)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: goals } = await (supabase.from("savings_goals") as any)
    .select("current_amount, currency")
    .gt("current_amount", 0);

  let totalSavingsGoalsIdr = 0;
  if (goals) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const g of goals as any[]) {
      totalSavingsGoalsIdr += convertAmount(
        Number(g.current_amount),
        g.currency || "IDR",
        displayCurrency,
        rates,
      );
    }
  }

  const totalAssets =
    totalAccountsIdr +
    totalStockHoldingsIdr +
    totalReceivablesIdr +
    totalSavingsGoalsIdr;
  const netWorthIdr = totalAssets - totalDebtsIdr;

  return {
    totalAccountsIdr,
    totalStockHoldingsIdr,
    totalReceivablesIdr,
    totalSavingsGoalsIdr,
    totalDebtsIdr,
    netWorthIdr,
    exchangeRate: rates.IDR || 16200,
    rates,
  };
}
