import type {
  SplitBillItem,
  SplitBillItemAssignment,
  SplitBillCharge,
  SplitBillParticipant,
  SplitBillCalculation,
  SplitBillPersonTotal,
} from "@/types/split-bill";

function roundMoney(value: number, decimals = 2): number {
  const f = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * f) / f;
}

function decimalsForCurrency(currency: string): number {
  const c = (currency || "IDR").toUpperCase();
  if (["IDR", "JPY", "KRW", "VND"].includes(c)) return 0;
  return 2;
}

export function getItemDiscountAmount(item: Pick<SplitBillItem, "line_subtotal" | "item_discount" | "item_discount_mode">): number {
  const line = Math.max(0, Number(item.line_subtotal) || 0);
  const raw = Number(item.item_discount) || 0;
  const mode = item.item_discount_mode === "percent" ? "percent" : "fixed";
  const disc = mode === "percent" ? (line * Math.min(Math.max(raw, 0), 100)) / 100 : Math.max(raw, 0);
  return Math.min(Math.max(disc, 0), line);
}

export function getItemNetSubtotal(item: Pick<SplitBillItem, "line_subtotal" | "item_discount" | "item_discount_mode">): number {
  const line = Math.max(0, Number(item.line_subtotal) || 0);
  return Math.max(0, line - getItemDiscountAmount(item));
}

export function computeBillChargesNet(
  itemsSubtotalNet: number,
  charges: SplitBillCharge[],
): { net: number; adds: number; discounts: number } {
  let adds = 0;
  let discounts = 0;
  for (const ch of charges || []) {
    const val = Number(ch.amount_value) || 0;
    const amount =
      ch.amount_mode === "percent" ? (itemsSubtotalNet * val) / 100 : val;
    if (ch.kind === "discount") discounts += amount;
    else adds += amount; // tax, service, other treated as additions
  }
  return { net: adds - discounts, adds, discounts };
}

export function calculateSplitBill(params: {
  currency: string;
  grandTotal: number;
  items: SplitBillItem[];
  participants: SplitBillParticipant[];
  assignments: SplitBillItemAssignment[];
  charges: SplitBillCharge[];
  /** proportional = biaya dibagi sesuai nilai item; equal = semua orang bayar sama */
  splitMode?: "proportional" | "equal";
}): SplitBillCalculation {
  const decimals = decimalsForCurrency(params.currency);
  const tolerance = decimals === 0 ? 0.5 : 0.01;
  const items = params.items || [];
  const participants = params.participants || [];
  const assignments = params.assignments || [];
  const charges = params.charges || [];

  const itemsSubtotal = roundMoney(
    items.reduce((s, it) => s + getItemNetSubtotal(it), 0),
    decimals,
  );
  const itemDiscountsTotal = roundMoney(
    items.reduce((s, it) => s + getItemDiscountAmount(it), 0),
    decimals,
  );

  const { net: chargesNet } = computeBillChargesNet(itemsSubtotal, charges);
  const chargesTotal = roundMoney(chargesNet, decimals);
  const computedGrandTotal = roundMoney(itemsSubtotal + chargesTotal, decimals);
  // Build per-person base (item shares)
  const perPersonMap = new Map<string, SplitBillPersonTotal>();
  for (const p of participants) {
    perPersonMap.set(p.id, {
      participant_id: p.id,
      name: p.name,
      is_me: !!p.is_me,
      items_subtotal: 0,
      charges_share: 0,
      total: 0,
      charges_breakdown: { tax: 0, service: 0, discount: 0, other: 0 },
      item_lines: [],
    });
  }

  const assignmentsByItem = new Map<string, SplitBillItemAssignment[]>();
  for (const a of assignments) {
    if (!assignmentsByItem.has(a.item_id)) assignmentsByItem.set(a.item_id, []);
    assignmentsByItem.get(a.item_id)!.push(a);
  }

  const unassigned_item_ids: string[] = [];
  const isEqual = params.splitMode === "equal";

  for (const item of items) {
    const qty = Number(item.quantity) || 0;
    const itemAssignments = (assignmentsByItem.get(item.id) || []).filter(
      (a) => Number(a.share_quantity) > 0 && perPersonMap.has(a.participant_id),
    );
    const assignedQty = itemAssignments.reduce(
      (s, a) => s + Number(a.share_quantity),
      0,
    );
    // Consider unassigned if quantities don't match (with small tolerance)
    // (di mode "merata" assignment per-item tidak dipakai)
    if (!isEqual && (qty <= 0 || Math.abs(assignedQty - qty) > 0.0001)) {
      unassigned_item_ids.push(item.id);
    }
    if (qty <= 0) continue;
    if (isEqual) continue;
    for (const a of itemAssignments) {
      const shareQty = Number(a.share_quantity) || 0;
      if (shareQty <= 0) continue;
      const gross = (Number(item.line_subtotal) * shareQty) / qty;
      const discount = (getItemDiscountAmount(item) * shareQty) / qty;
      const amount = gross - discount;
      const person = perPersonMap.get(a.participant_id);
      if (!person) continue;
      person.items_subtotal += amount;
      person.item_lines.push({
        item_id: item.id,
        name: item.name,
        share_quantity: shareQty,
        amount,
        gross_amount: gross,
        discount_amount: discount,
      });
    }
  }
  // Allocate bill-level charges proportionally to each person's items_subtotal
  // (dipisah per jenis: pajak / service / diskon / lainnya)
  const perPersons = Array.from(perPersonMap.values());
  const baseSum = perPersons.reduce((s, p) => s + p.items_subtotal, 0);

  const chargeAmount = (ch: SplitBillCharge): number => {
    const val = Number(ch.amount_value) || 0;
    return ch.amount_mode === "percent" ? (itemsSubtotal * val) / 100 : val;
  };

  if (params.splitMode === "equal") {
    // Bagi rata: semua orang bayar sama, tanpa bergantung pada item siapa.
    const n = perPersons.length || 1;
    const itemsEach = itemsSubtotal / n;
    for (const p of perPersons) {
      p.items_subtotal = itemsEach;
      const bd = p.charges_breakdown;
      for (const ch of charges || []) {
        const share = chargeAmount(ch) / n;
        if (ch.kind === "tax") bd.tax += share;
        else if (ch.kind === "service") bd.service += share;
        else if (ch.kind === "discount") bd.discount -= share;
        else bd.other += share;
      }
      p.charges_share = bd.tax + bd.service + bd.discount + bd.other;
    }
  } else if (baseSum > 0) {
    for (const p of perPersons) {
      const bd = p.charges_breakdown;
      for (const ch of charges || []) {
        const share = (chargeAmount(ch) * p.items_subtotal) / baseSum;
        if (ch.kind === "tax") bd.tax += share;
        else if (ch.kind === "service") bd.service += share;
        else if (ch.kind === "discount") bd.discount -= share;
        else bd.other += share;
      }
      p.charges_share = bd.tax + bd.service + bd.discount + bd.other;
    }
  } else if (perPersons.length > 0 && chargesTotal !== 0) {
    // no item base but charges exist: split equally (per jenis)
    const n = perPersons.length;
    for (const p of perPersons) {
      const bd = p.charges_breakdown;
      for (const ch of charges || []) {
        const share = chargeAmount(ch) / n;
        if (ch.kind === "tax") bd.tax += share;
        else if (ch.kind === "service") bd.service += share;
        else if (ch.kind === "discount") bd.discount -= share;
        else bd.other += share;
      }
      p.charges_share = bd.tax + bd.service + bd.discount + bd.other;
    }
  }
  // Round and balance so sum equals target grand total
  const targetGrand = Number(params.grandTotal) || computedGrandTotal;
  for (const p of perPersons) {
    p.items_subtotal = roundMoney(p.items_subtotal, decimals);
    p.charges_breakdown.tax = roundMoney(p.charges_breakdown.tax, decimals);
    p.charges_breakdown.service = roundMoney(p.charges_breakdown.service, decimals);
    p.charges_breakdown.discount = roundMoney(p.charges_breakdown.discount, decimals);
    p.charges_breakdown.other = roundMoney(p.charges_breakdown.other, decimals);
    p.charges_share = roundMoney(
      p.charges_breakdown.tax +
        p.charges_breakdown.service +
        p.charges_breakdown.discount +
        p.charges_breakdown.other,
      decimals,
    );
    p.item_lines = p.item_lines.map((l) => ({
      ...l,
      amount: roundMoney(l.amount, decimals),
      gross_amount: roundMoney(l.gross_amount, decimals),
      discount_amount: roundMoney(l.discount_amount, decimals),
    }));
    p.total = roundMoney(p.items_subtotal + p.charges_share, decimals);
  }

  let sumTotals = roundMoney(
    perPersons.reduce((s, p) => s + p.total, 0),
    decimals,
  );
  let diff = roundMoney(targetGrand - sumTotals, decimals);
  // Adjust rounding difference on the largest share (or "me") to force balance to target.
  // Never let the adjustment push a person's total below zero.
  if (diff !== 0 && perPersons.length > 0) {
    const candidates = [
      ...(perPersons.filter((p) => p.is_me && p.total > 0)),
      ...[...perPersons].sort((a, b) => b.total - a.total),
    ];
    const adjustTarget = candidates.find((p) => p.total + diff >= 0);
    if (adjustTarget) {
      const bd = adjustTarget.charges_breakdown;
        // Masukkan selisih pembulatan ke komponen biaya terbesar (biar tetap konsisten).
      const buckets: Array<keyof typeof bd> = ["tax", "service", "other", "discount"];
      const biggest = buckets.reduce((best, k) =>
        Math.abs(bd[k]) > Math.abs(bd[best]) ? k : best,
      );
      bd[biggest] = roundMoney(bd[biggest] + diff, decimals);
      adjustTarget.charges_share = roundMoney(
        bd.tax + bd.service + bd.discount + bd.other,
        decimals,
      );
      adjustTarget.total = roundMoney(adjustTarget.items_subtotal + adjustTarget.charges_share, decimals);
      sumTotals = roundMoney(
        perPersons.reduce((s, p) => s + p.total, 0),
        decimals,
      );
      diff = roundMoney(targetGrand - sumTotals, decimals);
    }
  }

  const difference = roundMoney(targetGrand - sumTotals, decimals);
  const target_mismatch = roundMoney(targetGrand - computedGrandTotal, decimals);
  const is_balanced =
    Math.abs(difference) < tolerance &&
    Math.abs(target_mismatch) < tolerance &&
    unassigned_item_ids.length === 0;

  return {
    items_subtotal: itemsSubtotal,
    item_discounts_total: itemDiscountsTotal,
    charges_total: chargesTotal,
    computed_grand_total: computedGrandTotal,
    target_grand_total: roundMoney(targetGrand, decimals),
    per_person: perPersons,
    is_balanced,
    difference,
    target_mismatch,
    unassigned_item_ids,
  };
}

/**
 * Deskripsi "porsi saya" (dipakai buat isi transaksi yang tercatat).
 * Dipakai client & server supaya formatnya sama persis.
 */
export function buildMyPortionDescriptionFromRows(params: {
  title: string;
  items?: Array<{ id: string; name: string }>;
  assignments?: Array<{ item_id: string; participant_id: string; share_quantity: number }>;
  myId?: string | null;
}): string {
  return `Split Bill - ${params.title || "Patungan"}`.slice(0, 2000);
}

/**
 * Parse cookie UI Split Bill, contoh: "2" (step 2) atau "1e" (step 1 + mode edit).
 * Dipakai server untuk mengembalikan posisi langkah setelah refresh.
 */
export function parseSplitBillUiCookie(
  value?: string | null,
): { step: 1 | 2 | 3 | 4; editing: boolean; isEditing: boolean } | null {
  if (!value) return null;
  const m = /^([1-4])(e?)(x?)$/.exec(String(value).trim());
  if (!m) return null;
  return {
    step: Number(m[1]) as 1 | 2 | 3 | 4,
    editing: m[2] === "e",
    isEditing: m[3] === "x",
  };
}

export function formatSplitSummaryText(params: {
  title: string;
  currency: string;
  grandTotal: number;
  calc: SplitBillCalculation;
  includeBrand?: boolean;
  language?: "id" | "en";
  /** equal = semua bayar sama, qty pecahan disembunyikan */
  splitMode?: "proportional" | "equal";
}): string {
  const { title, currency, grandTotal, calc } = params;
  const lang = params.language === "en" ? "en" : "id";
  const safeCurrency = /^[A-Za-z]{3}$/.test(currency || "") ? currency.toUpperCase() : "IDR";
  const fmt = (n: number) =>
    new Intl.NumberFormat(lang === "id" ? "id-ID" : "en-US", {
      style: "currency",
      currency: safeCurrency,
      maximumFractionDigits: decimalsForCurrency(safeCurrency),
      minimumFractionDigits: decimalsForCurrency(safeCurrency),
    }).format(n);
  const fmtQty = (v: number) => {
    const n = Number(v) || 0;
    return Number.isInteger(n) ? String(n) : n.toFixed(4).replace(/\.?0+$/, "");
  };

  const lines: string[] = [];
  const titleWithMode =
    params.splitMode === "equal" ? `${title || "Pocketly"} (Equal Split)` : title || "Pocketly";
  lines.push(lang === "id" ? `Patungan - ${titleWithMode}` : `Split Bill - ${titleWithMode}`);
  lines.push(`Total: ${fmt(grandTotal)}`);
  lines.push("");
  for (const p of calc.per_person) {
    lines.push(`${p.name}: ${fmt(p.total)}`);
    for (const l of p.item_lines) {
      const label =
        params.splitMode === "equal"
          ? l.name
          : `${l.name} x${fmtQty(l.share_quantity)}`;
      lines.push(`  - ${label}: ${fmt(l.amount)}`);
    }
    if (Math.abs(p.charges_share) > 0.0001) {
      lines.push(
        lang === "id"
          ? `  - Pajak/Service/Diskon/biaya: ${fmt(p.charges_share)}`
          : `  - Tax/Service/Discount/charges: ${fmt(p.charges_share)}`,
      );
    }
  }
  if (params.includeBrand !== false) {
    lines.push("");
    lines.push(lang === "id" ? "Dihitung dengan Pocketly" : "Calculated with Pocketly");
  }
  return lines.join("\n");
}
