type AnyClient = { from: (table: string) => any };

export interface AssetPrice {
  kind: "stock" | "crypto" | "etf";
  symbol: string;
  price: number;
  currency: string;
  fetchedAt: string;
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

async function fetchStooqPrices(
  kind: "stock" | "etf",
  symbols: string[],
): Promise<Array<{ symbol: string; price: number; currency: string }>> {
  if (symbols.length === 0) return [];
  const suffix = kind === "stock" ? ".jk" : ".us";
  const stooqSymbols = symbols.map(
    (s) => `${s.toLowerCase()}${suffix}`,
  );
  const res = await fetch(
    `https://stooq.com/q/l/?s=${stooqSymbols.join(",")}&f=sd2t2ohlcv&h&e=csv`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error(`Stooq HTTP ${res.status}`);
  const text = await res.text();
  const lines = text.trim().split("\n").slice(1); // skip header
  const out: Array<{ symbol: string; price: number; currency: string }> = [];
  lines.forEach((line, i) => {
    const parts = line.split(",");
    // Symbol,Date,Time,Open,High,Low,Close,Volume
    const close = Number(parts[6]);
    const sym = symbols[i];
    if (sym && close > 0) {
      out.push({
        symbol: sym.toUpperCase(),
        price: close,
        currency: kind === "stock" ? "IDR" : "USD",
      });
    }
  });
  return out;
}

/**
 * Refresh cached market prices for tickers actually held by any user.
 * Global cache — one fetch per kind per day via cron, plus manual
 * refresh reuses the same function with the admin client.
 */
export async function refreshAssetPrices(
  supabase: AnyClient,
): Promise<{ updated: number; skipped: string[] }> {
  const skipped: string[] = [];

  // Distinct owned symbols per kind
  const [stocksRes, cryptoRes, etfRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from("stock_holdings") as any)
      .select("ticker")
      .gt("total_cost", 0),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from("crypto_holdings") as any)
      .select("symbol")
      .gt("quantity", 0)
      .gt("cost_basis", 0),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from("etf_holdings") as any)
      .select("ticker")
      .gt("total_cost", 0),
  ]);

  const stockSymbols = Array.from(
    new Set(((stocksRes.data || []) as any[]).map((r) => String(r.ticker || "").toUpperCase()).filter(Boolean)),
  ) as string[];
  const cryptoSymbols = Array.from(
    new Set(((cryptoRes.data || []) as any[]).map((r) => String(r.symbol || "").toUpperCase()).filter(Boolean)),
  ) as string[];
  const etfSymbols = Array.from(
    new Set(((etfRes.data || []) as any[]).map((r) => String(r.ticker || "").toUpperCase()).filter(Boolean)),
  ) as string[];

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
  await tryFetch("stock", stockSymbols, () => fetchStooqPrices("stock", stockSymbols));
  await tryFetch("etf", etfSymbols, () => fetchStooqPrices("etf", etfSymbols));

  let updated = 0;
  for (const batch of batches) {
    for (const row of batch.rows) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from("asset_prices") as any).upsert(
        {
          kind: batch.kind,
          symbol: row.symbol,
          price: row.price,
          currency: row.currency,
          source: batch.kind === "crypto" ? "coingecko" : "stooq",
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.from("asset_prices") as any)
    .select("kind, symbol, price, currency, fetched_at")
    .limit(1000);
  const map = new Map<string, AssetPrice>();
  for (const r of (data || []) as any[]) {
    map.set(`${r.kind}:${r.symbol}`, {
      kind: r.kind,
      symbol: r.symbol,
      price: Number(r.price) || 0,
      currency: r.currency || "IDR",
      fetchedAt: r.fetched_at,
    });
  }
  return map;
}
