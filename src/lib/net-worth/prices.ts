type QueryResult<T> = PromiseLike<{ data: T[] | null; error?: unknown }>;
type QueryChain<T> = {
  select: (columns: string) => QueryChain<T>;
  gt: (column: string, value: unknown) => QueryChain<T>;
  limit: (count: number) => QueryChain<T>;
  upsert: (
    values: unknown,
    options: { onConflict: string },
  ) => PromiseLike<{ error?: { message?: string } | null }>;
} & QueryResult<T>;

type AnyClient = { from: (table: string) => QueryChain<Record<string, unknown>> };

export interface AssetPrice {
  kind: "stock" | "crypto" | "etf";
  symbol: string;
  price: number;
  currency: string;
  fetchedAt: string;
}

interface HoldingSymbolRow {
  ticker?: string | null;
  symbol?: string | null;
}

interface AssetPriceRow {
  kind?: string | null;
  symbol?: string | null;
  price?: number | string | null;
  currency?: string | null;
  fetched_at?: string | null;
}

const COINGECKO_IDS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  BNB: "binance-coin",
  XRP: "ripple",
  ADA: "cardano",
  DOGE: "dogecoin",
  TRX: "tron",
  DOT: "polkadot",
  MATIC: "matic-network",
  POL: "polygon-ecosystem-token",
  AVAX: "avalanche-2",
  LINK: "chainlink",
  UNI: "uniswap",
  ATOM: "cosmos",
  NEAR: "near-protocol",
  ARB: "arbitrum",
  OP: "optimism",
  INJ: "injective-protocol",
  SUI: "sui",
  APT: "aptos",
  PEPE: "pepe",
  WIF: "dogwifhat",
  BONK: "bonk",
  JUP: "jupiter-ag",
  RENDER: "render-token",
  LTC: "litecoin",
  BCH: "bitcoin-cash",
  XLM: "stellar",
  TON: "the-open-network",
  USDT: "tether",
  USDC: "usd-coin",
  IDRT: "idrt",
};

/** Resolve CoinGecko ids adaptively: static top-coin map first, then
 *  CoinGecko's full coins list for any symbol outside the map. */
async function resolveCoinGeckoIds(
  symbols: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const missing: string[] = [];
  for (const s of symbols) {
    const key = s.toUpperCase();
    const known = COINGECKO_IDS[key];
    if (known) map.set(key, known);
    else missing.push(key);
  }
  if (missing.length === 0) return map;
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/coins/list", {
      cache: "no-store",
    });
    if (!res.ok) return map;
    const list = (await res.json()) as Array<{ id: string; symbol: string }>;
    const bySymbol = new Map<string, string>();
    for (const coin of list) {
      const sym = String(coin.symbol || "").toUpperCase();
      if (!bySymbol.has(sym)) bySymbol.set(sym, coin.id);
    }
    for (const key of missing) {
      const id = bySymbol.get(key);
      if (id) map.set(key, id);
    }
  } catch (err) {
    console.error("[prices] CoinGecko coins/list failed:", err);
  }
  return map;
}

async function fetchCryptoPrices(
  symbols: string[],
): Promise<Array<{ symbol: string; price: number; currency: string }>> {
  const idMap = await resolveCoinGeckoIds(symbols);
  const ids = symbols
    .map((s) => idMap.get(s.toUpperCase()))
    .filter(Boolean) as string[];
  if (ids.length === 0) return [];
  const res = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=idr,usd`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
  const data = (await res.json()) as Record<string, { idr?: number; usd?: number }>;
  const out: Array<{ symbol: string; price: number; currency: string }> = [];
  for (const sym of symbols) {
    const coinId = idMap.get(sym.toUpperCase());
    if (!coinId) continue;
    const entry = data[coinId];
    const price = entry?.idr ?? entry?.usd;
    if (price && price > 0) {
      out.push({
        symbol: sym.toUpperCase(),
        price,
        currency: entry?.idr ? "IDR" : "USD",
      });
    }
  }
  return out;
}

async function fetchYahooPrice(
  yahooSymbol: string,
): Promise<{ price: number; currency: string } | null> {
  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      yahooSymbol,
    )}?range=1d&interval=1d`,
    {
      cache: "no-store",
      headers: {
        // Yahoo rejects requests without a browser-like UA.
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "application/json",
      },
    },
  );
  if (!res.ok) throw new Error(`Yahoo HTTP ${res.status} (${yahooSymbol})`);

  const data = (await res.json()) as {
    chart?: {
      result?: Array<{
        meta?: {
          currency?: string;
          regularMarketPrice?: number;
          chartPreviousClose?: number;
        };
        indicators?: { quote?: Array<{ close?: Array<number | null> }> };
      }>;
    };
  };
  const result = data.chart?.result?.[0];
  const meta = result?.meta;
  const closes = result?.indicators?.quote?.[0]?.close;
  const lastClose = Array.isArray(closes)
    ? [...closes].reverse().find((v) => typeof v === "number" && v > 0)
    : undefined;
  const price = Number(
    meta?.regularMarketPrice ?? lastClose ?? meta?.chartPreviousClose,
  );
  if (!price || price <= 0) return null;

  const fallbackCurrency = yahooSymbol.toUpperCase().endsWith(".JK")
    ? "IDR"
    : "USD";
  return { price, currency: meta?.currency || fallbackCurrency };
}

/**
 * Yahoo covers both IDX (`BBCA.JK`) and US ETFs (`SPY`). The chart endpoint is
 * per-symbol, so fetch in small batches to stay polite with rate limits.
 */
async function fetchYahooPrices(
  kind: "stock" | "etf",
  symbols: string[],
): Promise<Array<{ symbol: string; price: number; currency: string }>> {
  if (symbols.length === 0) return [];

  const out: Array<{ symbol: string; price: number; currency: string }> = [];
  const batchSize = 5;

  for (let i = 0; i < symbols.length; i += batchSize) {
    const chunk = symbols.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      chunk.map(async (symbol) => {
        const yahooSymbol =
          kind === "stock"
            ? `${symbol.replace(/\.JK$/i, "")}.JK`
            : symbol.replace(/\.US$/i, "");
        const quote = await fetchYahooPrice(yahooSymbol);
        return quote
          ? { symbol: symbol.toUpperCase(), price: quote.price, currency: quote.currency }
          : null;
      }),
    );
    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        out.push(result.value);
      } else if (result.status === "rejected") {
        console.error("[prices] Yahoo fetch failed:", result.reason);
      }
    }
  }

  return out;
}

/**
 * Refresh cached market prices for tickers actually held by any user.
 * Global cache — one fetch per owned symbol per day via cron, plus manual
 * refresh reuses the same function with the admin client.
 */
export async function refreshAssetPrices(
  supabase: AnyClient,
): Promise<{ updated: number; skipped: string[] }> {
  const skipped: string[] = [];

  // Distinct owned symbols per kind
  const [stocksRes, cryptoRes, etfRes] = await Promise.all([
    supabase.from("stock_holdings").select("ticker").gt("total_cost", 0),
    supabase
      .from("crypto_holdings")
      .select("symbol")
      .gt("quantity", 0)
      .gt("cost_basis", 0),
    supabase.from("etf_holdings").select("ticker").gt("total_cost", 0),
  ]);

  const stockSymbols = Array.from(
    new Set(
      ((stocksRes.data || []) as HoldingSymbolRow[])
        .map((r) => String(r.ticker || "").toUpperCase())
        .filter(Boolean),
    ),
  );
  const cryptoSymbols = Array.from(
    new Set(
      ((cryptoRes.data || []) as HoldingSymbolRow[])
        .map((r) => String(r.symbol || "").toUpperCase())
        .filter(Boolean),
    ),
  );
  const etfSymbols = Array.from(
    new Set(
      ((etfRes.data || []) as HoldingSymbolRow[])
        .map((r) => String(r.ticker || "").toUpperCase())
        .filter(Boolean),
    ),
  );

  const batches: Array<{
    kind: "stock" | "crypto" | "etf";
    rows: Array<{ symbol: string; price: number; currency: string }>;
  }> = [];

  const tryFetch = async (
    kind: "stock" | "crypto" | "etf",
    symbols: string[],
    fetcher: () => Promise<Array<{ symbol: string; price: number; currency: string }>>,
  ) => {
    if (symbols.length === 0) return;
    try {
      const rows = await fetcher();
      batches.push({ kind, rows });
      const got = new Set(rows.map((r) => r.symbol));
      symbols.filter((s) => !got.has(s)).forEach((s) => skipped.push(`${kind}:${s}`));
    } catch (err) {
      console.error(`[prices] ${kind} fetch failed:`, err);
      symbols.forEach((s) => skipped.push(`${kind}:${s}`));
    }
  };

  await tryFetch("crypto", cryptoSymbols, () => fetchCryptoPrices(cryptoSymbols));
  await tryFetch("stock", stockSymbols, () => fetchYahooPrices("stock", stockSymbols));
  await tryFetch("etf", etfSymbols, () => fetchYahooPrices("etf", etfSymbols));

  let updated = 0;
  for (const batch of batches) {
    for (const row of batch.rows) {
      const { error } = await supabase.from("asset_prices").upsert(
        {
          kind: batch.kind,
          symbol: row.symbol,
          price: row.price,
          currency: row.currency,
          source: batch.kind === "crypto" ? "coingecko" : "yahoo",
          fetched_at: new Date().toISOString(),
        },
        { onConflict: "kind,symbol" },
      );
      if (!error) updated++;
    }
  }

  return { updated, skipped };
}

export async function getAssetPrices(
  supabase: AnyClient,
): Promise<Map<string, AssetPrice>> {
  const { data } = await supabase
    .from("asset_prices")
    .select("kind, symbol, price, currency, fetched_at")
    .limit(1000);
  const map = new Map<string, AssetPrice>();
  for (const r of (data || []) as AssetPriceRow[]) {
    const kind = r.kind === "stock" || r.kind === "crypto" || r.kind === "etf" ? r.kind : null;
    const symbol = String(r.symbol || "").toUpperCase();
    if (!kind || !symbol) continue;
    map.set(`${kind}:${symbol}`, {
      kind,
      symbol,
      price: Number(r.price) || 0,
      currency: r.currency || "IDR",
      fetchedAt: String(r.fetched_at || ""),
    });
  }
  return map;
}
