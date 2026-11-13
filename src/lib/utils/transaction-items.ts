import { formatCurrency } from "@/lib/utils/currency";
import { SUPPORTED_CURRENCIES } from "@/lib/constants/currencies";

/**
 * Shared helpers for the `[Items: ...]` compound description format.
 *
 * Storage examples:
 * - Legacy (no qty):            `Beras (Rp 75.000), Gula (Rp 20.000)`
 * - With qty (paren = UNIT):    `KOL BEIJING x0.414 (Rp 24.900), TAHU x4 (Rp 2.000)`
 * - With qty + printed subtotal: `KOL BEIJING x0.414 (Rp 24.900) = Rp 10.309`
 *
 * The `= Rp SUBTOTAL` suffix is the line total AS PRINTED on the receipt
 * (already rounded by the POS), copied from OCR. It must be stored explicitly
 * so weighed items (0.414 x 24.900 = 10.308,6 on paper 10.309) survive the
 * round-trip create -> detail -> edit without a 0,4 stale remainder.
 */

export interface TransactionItem {
  name: string;
  /** Plain string number, dot decimal e.g. "0.414" / "4" / "1" */
  quantity: string;
  /** Unit price as plain string number e.g. "24900" */
  price: string;
  /** Printed line total as plain string number, if stored */
  subtotal?: string;
  /** Number of people sharing this line item (for split/patungan). Optional. */
  shareCount?: string;
  /** User's own portion of this line item (manual / rounded override). Optional. */
  mySubtotal?: string;
}

/**
 * Reverse-parse angka dari string hasil formatCurrency, misal "Rp 6.000",
 * "$6.00", atau "S$1.340,50". HARUS sinkron dengan formatCurrency:
 * - IDR (id-ID): titik = pemisah ribuan, koma = desimal
 * - USD/SGD (en-US/en-SG): koma = pemisah ribuan, titik = desimal
 */
export function parseFormattedPriceToPlainString(raw: string): string {
  const s = raw.trim();
  const isUsdOrSgd = /^\$|^S\$|USD|SGD/i.test(s);

  let numeric = s.replace(/[^0-9.,-]/g, "");

  if (isUsdOrSgd) {
    numeric = numeric.replace(/,/g, "");
  } else {
    numeric = numeric.replace(/\./g, "").replace(",", ".");
  }

  const num = parseFloat(numeric);
  return isNaN(num) ? "" : String(num);
}

/**
 * Line total for one row: prefer the printed subtotal copied from the
 * receipt, otherwise fall back to qty * price rounded to the currency's
 * decimals (IDR -> whole rupiah, USD/SGD -> cents).
 *
 * The fallback rounding matters for legacy rows saved before the explicit
 * `= Rp SUBTOTAL` suffix existed: `KOL BEIJING x0.414 (Rp 24.900)` has no
 * stored subtotal, so 0.414 * 24.900 = 10.308,6 must round to 10.309
 * (as the POS printed) instead of showing Rp 10.308,60.
 */
export function getItemTotal(
  item: TransactionItem,
  currency: string = "IDR",
): number {
  const printed = parseFloat(item.subtotal ?? "");
  if (!isNaN(printed) && printed > 0) return printed;
  const qRaw = parseFloat(item.quantity);
  const q = Number.isFinite(qRaw) && qRaw > 0 ? qRaw : 1;
  const p = parseFloat(item.price) || 0;
  const code = (currency || "IDR").toUpperCase() as keyof typeof SUPPORTED_CURRENCIES;
  const decimals = SUPPORTED_CURRENCIES[code]?.decimals ?? 0;
  const factor = 10 ** decimals;
  return Math.round(q * p * factor) / factor;
}

/**
 * User's own portion for a line item.
 * Prefer explicit mySubtotal, else split subtotal by shareCount (rounded),
 * else fall back to the full receipt subtotal.
 */
export function getItemMyTotal(
  item: TransactionItem,
  currency: string = "IDR",
): number {
  const explicit = parseFloat(item.mySubtotal ?? "");
  if (!isNaN(explicit) && explicit > 0) return explicit;

  const full = getItemTotal(item, currency);
  const shares = parseFloat(item.shareCount ?? "");
  if (!isNaN(shares) && shares >= 2) {
    const code = (currency || "IDR").toUpperCase() as keyof typeof SUPPORTED_CURRENCIES;
    const decimals = SUPPORTED_CURRENCIES[code]?.decimals ?? 0;
    const factor = 10 ** decimals;
    return Math.ceil((full / shares) * factor) / factor;
  }
  return full;
}

/**
 * Split "[Items: a (Rp 1.000), b (Rp 2.000,50)]" correctly.
 * - Commas inside parentheses (decimal/thousands) are not separators.
 * - Commas inside a `$1,340.50` style subtotal `= $1,340.50` are not separators
 *   because they are not followed by a space.
 * - Real separator is `", "` at depth 0.
 */
export function splitItemsRespectingParens(itemsText: string): string[] {
  const result: string[] = [];
  let depth = 0;
  let current = "";

  for (let i = 0; i < itemsText.length; i++) {
    const ch = itemsText[i];
    if (ch === "(") depth++;
    if (ch === ")") depth = Math.max(0, depth - 1);

    if (ch === "," && depth === 0) {
      const next = itemsText[i + 1];
      // Separator only if comma is followed by whitespace (or end).
      // Decimal/thousands commas are followed by a digit: "10.309,60" / "$1,340"
      if (next === " " || next === undefined) {
        result.push(current);
        current = "";
        continue;
      }
    }
    current += ch;
  }
  if (current.trim()) result.push(current);
  return result.map((s) => s.trim()).filter(Boolean);
}

function parseSingleItem(raw: string): TransactionItem | null {
  const text = raw.trim();
  if (!text) return null;

  let main = text;
  let subtotal: string | undefined;

  // Explicit printed subtotal: ") = Rp 10.309" at the end
  const eqMatch = text.match(/\)\s*=\s*(.+)$/);
  if (eqMatch && eqMatch.index !== undefined) {
    const parsedSub = parseFormattedPriceToPlainString(eqMatch[1]);
    if (parsedSub) subtotal = parsedSub;
    main = text.slice(0, eqMatch.index + 1); // keep up to ")"
  }

  // Price is inside the LAST "(...)" — names may contain their own parens
  const lastOpen = main.lastIndexOf("(");
  const lastClose = main.lastIndexOf(")");
  if (lastOpen === -1 || lastClose === -1 || lastClose < lastOpen) {
    // No price at all: treat whole text as name
    return { name: text, quantity: "1", price: "", subtotal };
  }

  const priceText = main.slice(lastOpen + 1, lastClose);
  const price = parseFormattedPriceToPlainString(priceText);
  const nameQty = main.slice(0, lastOpen).trim();

  // Extract trailing " xQTY" suffix (dot or comma decimal)
  const qtyMatch = nameQty.match(/\s+x([0-9]+(?:[.,][0-9]+)?)\s*$/i);
  let name = nameQty;
  let quantity = "1";
  if (qtyMatch) {
    quantity = qtyMatch[1].replace(",", ".");
    name = nameQty.slice(0, qtyMatch.index).trim();
  }

  if (!name) return null;
  return { name, quantity, price, subtotal };
}

/** Parse the inner text of `[Items: ...]` into structured items. */
export function parseItemsSummary(itemsText: string): TransactionItem[] {
  return splitItemsRespectingParens(itemsText)
    .map(parseSingleItem)
    .filter((i): i is TransactionItem => !!i && !!i.name);
}

/** Extract structured items from a full compound description. */
export function parseItemsFromDescription(
  rawDesc?: string | null,
): TransactionItem[] {
  if (!rawDesc) return [];
  const match = rawDesc.match(/\[Items:\s*([^\]]+)\]/);
  if (!match) return [];
  return parseItemsSummary(match[1]);
}

/**
 * Normalisasi isi kolom JSONB `transactions.items` jadi bentuk TransactionItem.
 * Aman dipakai buat data yang ditulis versi lama / format tak terduga.
 */
export function normalizeStoredItems(raw: unknown): TransactionItem[] {
  if (!Array.isArray(raw)) return [];
  const out: TransactionItem[] = [];
  for (const it of raw) {
    if (!it || typeof it !== "object") continue;
    const rec = it as Record<string, unknown>;
    const name = String(rec.name ?? "").trim();
    if (!name) continue;
    const item: TransactionItem = {
      name: name.slice(0, 200),
      quantity: rec.quantity != null ? String(rec.quantity) : "1",
      price: rec.price != null ? String(rec.price) : "",
    };
    if (rec.subtotal != null && String(rec.subtotal).trim() !== "") {
      item.subtotal = String(rec.subtotal);
    }
    if (rec.shareCount != null && String(rec.shareCount).trim() !== "") {
      item.shareCount = String(rec.shareCount);
    }
    if (rec.mySubtotal != null && String(rec.mySubtotal).trim() !== "") {
      item.mySubtotal = String(rec.mySubtotal);
    }
    out.push(item);
  }
  return out;
}

/** Format structured items back into the `[Items: ...]` inner text. */
export function formatItemsSummary(
  items: TransactionItem[],
  currency: string,
): string {
  const validItems = items.filter(
    (i) => i.name.trim() && parseFloat(i.price) > 0,
  );
  return validItems
    .map((i) => {
      const qRaw = parseFloat(i.quantity);
      const q = Number.isFinite(qRaw) && qRaw > 0 ? qRaw : 1;
      const p = parseFloat(i.price) || 0;
      const sub = getItemTotal(i, currency);
      const mySub = getItemMyTotal(i, currency);
      const shares = parseFloat(i.shareCount ?? "");
      const isShared =
        (!isNaN(shares) && shares >= 2) || (i.mySubtotal != null && mySub !== sub);
      const label = q !== 1 ? `${i.name.trim()} x${q}` : i.name.trim();
      const unit = formatCurrency(p, currency);
      // Store printed subtotal explicitly whenever qty != 1 so the
      // rounded POS total (10.309) is preserved, not recomputed.
      // Also keep it when a printed subtotal differs from qty * unit
      // (discount / rounding), even for qty == 1.
      const needsSubtotal =
        sub > 0 && (q !== 1 || (i.subtotal != null && sub !== p));
      const base = needsSubtotal
        ? `${label} (${unit}) = ${formatCurrency(sub, currency)}`
        : `${label} (${unit})`;
      if (!isShared) return base;
      const shareInfo =
        !isNaN(shares) && shares >= 2 ? `÷${shares}` : "split";
      return `${base} [${shareInfo}, mine ${formatCurrency(mySub, currency)}]`;
    })
    .join(", ");
}
