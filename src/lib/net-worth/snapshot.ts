import { computeNetWorthForUser } from "@/lib/net-worth/compute";
import { getAssetPrices } from "@/lib/net-worth/prices";
import type { ForexRatesMap } from "@/lib/utils/currency";

type QueryChain = {
  upsert: (
    values: unknown,
    options: { onConflict: string },
  ) => PromiseLike<{ error?: { message?: string } | null }>;
};

type AnyClient = { from: (table: string) => QueryChain };

/**
 * Snapshot one user's net worth for `snapshotDate` (YYYY-MM-DD).
 * Upserts on (user_id, snapshot_date) so a same-day cron re-run
 * overwrites instead of duplicating.
 */
export async function snapshotNetWorthForUser(
  supabase: AnyClient,
  userId: string,
  snapshotDate: string,
  rates: ForexRatesMap,
): Promise<{ ok: boolean; error?: string }> {
  const prices = await getAssetPrices(
    supabase as unknown as Parameters<typeof getAssetPrices>[0],
  );
  const computed = await computeNetWorthForUser(
    supabase as unknown as Parameters<typeof computeNetWorthForUser>[0],
    userId,
    rates,
    prices,
  );

  const breakdown = {
    accounts: computed.totalAccountsIdr,
    stocks: computed.totalStockHoldingsIdr,
    crypto: computed.totalCryptoHoldingsIdr,
    etf: computed.totalEtfHoldingsIdr,
    receivables: computed.totalReceivablesIdr,
    goals: computed.totalSavingsGoalsIdr,
    debts: computed.totalDebtsIdr,
  };

  const { error } = await supabase.from("net_worth_snapshots").upsert(
    {
      user_id: userId,
      snapshot_date: snapshotDate,
      total_assets_idr: computed.totalAssetsIdr,
      total_liabilities_idr: computed.totalDebtsIdr,
      net_worth_idr: computed.netWorthIdr,
      breakdown,
      rates,
    },
    { onConflict: "user_id,snapshot_date" },
  );

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
