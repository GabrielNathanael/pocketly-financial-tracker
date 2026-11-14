export type SplitBillStatus = "draft" | "balanced";
export type SplitChargeKind = "tax" | "service" | "discount" | "other";
export type SplitAmountMode = "percent" | "fixed";

export interface SplitBillContact {
  id: string;
  user_id: string;
  name: string;
  avatar_style?: string | null;
  avatar_seed?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SplitBill {
  id: string;
  user_id: string;
  title: string;
  bill_date: string; // date
  currency: string;
  subtotal_amount: number;
  grand_total_amount: number;
  status: SplitBillStatus;
  /** proportional = biaya dibagi sesuai nilai item; equal = semua orang bayar sama */
  split_mode?: "proportional" | "equal";
  notes: string | null;
  my_participant_id: string | null;
  my_recorded_transaction_id: string | null;
  my_recorded_at: string | null;
  /** Client-generated idempotency key for manual draft creation attempts. */
  manual_draft_key?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SplitBillParticipant {
  id: string;
  split_bill_id: string;
  user_id: string;
  contact_id: string | null;
  name: string;
  is_me: boolean;
  avatar_style?: string | null;
  avatar_seed?: string | null;
  sort_order: number;
  created_at: string;
}

export interface SplitBillItem {
  id: string;
  split_bill_id: string;
  user_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  line_subtotal: number;
  /** Nilai input diskon: nominal (fixed) atau persen (percent), tergantung item_discount_mode. */
  item_discount: number;
  /** fixed = nominal, percent = persen dari line_subtotal */
  item_discount_mode?: SplitAmountMode;
  sort_order: number;
  notes: string | null;
  created_at: string;
}

export interface SplitBillItemAssignment {
  id: string;
  item_id: string;
  participant_id: string;
  split_bill_id: string;
  user_id: string;
  share_quantity: number;
  created_at: string;
}

export interface SplitBillCharge {
  id: string;
  split_bill_id: string;
  user_id: string;
  name: string;
  kind: SplitChargeKind;
  amount_mode: SplitAmountMode;
  amount_value: number;
  sort_order: number;
  created_at: string;
}

export interface SplitBillImage {
  id: string;
  split_bill_id: string;
  user_id: string;
  storage_path: string;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  sort_order: number;
  created_at: string;
  signed_url?: string;
}

export interface SplitBillFull extends SplitBill {
  participants: SplitBillParticipant[];
  items: SplitBillItem[];
  assignments: SplitBillItemAssignment[];
  charges: SplitBillCharge[];
  images: SplitBillImage[];
}

export interface SplitBillPersonTotal {
  participant_id: string;
  name: string;
  is_me: boolean;
  items_subtotal: number;
  charges_share: number; // net share of bill-level charges (tax/service +, discount -)
  total: number;
  /** Rincian biaya tingkat struk per orang (dipisah per jenis) */
  charges_breakdown: {
    tax: number;
    service: number;
    discount: number; // nilai negatif (mengurangi)
    other: number;
  };
  item_lines: Array<{
    item_id: string;
    name: string;
    share_quantity: number;
    amount: number; // bersih (setelah diskon item)
    gross_amount: number; // sebelum diskon item
    discount_amount: number; // potongan diskon item untuk bagian ini
  }>;
}

export interface SplitBillCalculation {
  items_subtotal: number;
  item_discounts_total: number;
  charges_total: number; // net (adds - discounts)
  computed_grand_total: number;
  target_grand_total: number;
  per_person: SplitBillPersonTotal[];
  is_balanced: boolean;
  difference: number; // target_grand_total - sum(per_person.total)
  target_mismatch: number; // target_grand_total - computed_grand_total
  unassigned_item_ids: string[];
}
