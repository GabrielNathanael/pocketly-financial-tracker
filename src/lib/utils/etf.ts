/** ETF US fractions: keep 6-decimal precision so installment (dicicil) buys
 *  with small nominals are recorded accurately instead of truncating to 0. */
export const ETF_QTY_PRECISION = 1_000_000;

export function roundEtfQuantity(value: number) {
  return Math.round(Number(value) * ETF_QTY_PRECISION) / ETF_QTY_PRECISION;
}

export function formatEtfUnits(v: number | string): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(6).replace(/\.?0+$/, "") || "0";
}
