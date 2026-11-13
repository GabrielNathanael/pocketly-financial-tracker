import {
  DEFAULT_FALLBACK_RATES,
  type ForexRatesMap,
} from "@/lib/utils/currency";

type QueryResult<T> = PromiseLike<{ data: T[] | null; error?: unknown }>;
type QueryChain<T> = {
  select: (columns: string) => QueryChain<T>;
  eq: (column: string, value: unknown) => QueryChain<T>;
  order: (column: string, opts: { ascending: boolean }) => QueryChain<T>;
  limit: (count: number) => QueryChain<T>;
  insert: (values: unknown) => PromiseLike<{ error?: { message?: string } | null }>;
} & QueryResult<T>;

type AnyClient = { from: (table: string) => QueryChain<Record<string, unknown>> };

interface ExchangeRateRow {
  target_currency?: string | null;
  rate?: number | string | null;
  fetched_at?: string | null;
}

/**
 * Fetch live USD-based rates and persist them to exchange_rates.
 * Uses the service-role admin client (cron), so it bypasses RLS.
 * On API failure, falls back to the newest stored rates, then defaults.
 */
export async function fetchAndSaveForexRatesAdmin(
  supabase: AnyClient,
): Promise<ForexRatesMap> {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const idr = Number(data?.rates?.IDR);
    const sgd = Number(data?.rates?.SGD);
    if (!idr || !sgd) throw new Error("Invalid rates payload");

    const now = new Date().toISOString();
    const { error } = await supabase.from("exchange_rates").insert([
      { base_currency: "USD", target_currency: "IDR", rate: idr, fetched_at: now },
      { base_currency: "USD", target_currency: "SGD", rate: sgd, fetched_at: now },
    ]);
    if (error) throw error;
    return { USD: 1, IDR: idr, SGD: sgd };
  } catch (err) {
    console.error("[forex] live fetch failed, using stored rates:", err);
    return getLatestForexRatesAdmin(supabase);
  }
}

export async function getLatestForexRatesAdmin(
  supabase: AnyClient,
): Promise<ForexRatesMap> {
  const { data } = await supabase
    .from("exchange_rates")
    .select("target_currency, rate, fetched_at")
    .eq("base_currency", "USD")
    .order("fetched_at", { ascending: false })
    .limit(50);

  const rates: ForexRatesMap = { ...DEFAULT_FALLBACK_RATES };
  const seen = new Set<string>();
  for (const r of (data ?? []) as ExchangeRateRow[]) {
    if (!r.target_currency || !r.rate || seen.has(r.target_currency)) continue;
    seen.add(r.target_currency);
    rates[r.target_currency] = Number(r.rate);
  }
  return rates;
}
