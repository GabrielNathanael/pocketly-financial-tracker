"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Split, Trash2, ArrowLeft, Receipt, Check, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/lib/utils/currency";
import { useLanguage } from "@/lib/i18n/language-context";
import { deleteSplitBill, deleteSplitBills } from "@/actions/split-bills";
import type { SplitBill } from "@/types/split-bill";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export function SplitBillClient({
  initialBills,
}: {
  initialBills: SplitBill[];
}) {
  const { t, language } = useLanguage();
  const router = useRouter();
  const [bills, setBills] = useState(initialBills);
  const [pendingDelete, setPendingDelete] = useState<SplitBill | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [filter, setFilter] = useState<"all" | "draft" | "balanced">("all");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const filters: Array<{ id: "all" | "draft" | "balanced"; label: string }> = [
    { id: "all", label: t.common.all },
    { id: "balanced", label: t.splitBill.balanced },
    { id: "draft", label: t.splitBill.draft },
  ];

  const filtered = useMemo(
    () => (filter === "all" ? bills : bills.filter((b) => b.status === filter)),
    [bills, filter],
  );

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      const res = await deleteSplitBill(pendingDelete.id);
      if (res?.error) { toast.error(res.error); return; }
      setBills((prev) => prev.filter((b) => b.id !== pendingDelete.id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(pendingDelete.id);
        return next;
      });
      toast.success(t.splitBill.deleted);
      setPendingDelete(null);
      router.refresh();
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = filtered.length > 0 && filtered.every((b) => next.has(b.id));
      if (allSelected) {
        filtered.forEach((b) => next.delete(b.id));
      } else {
        filtered.forEach((b) => next.add(b.id));
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setIsBulkDeleting(true);
    try {
      const res = await deleteSplitBills(ids);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      setBills((prev) => prev.filter((b) => !selectedIds.has(b.id)));
      toast.success(t.splitBill.deleted);
      setShowBulkDelete(false);
      clearSelection();
      router.refresh();
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const allFilteredSelected = filtered.length > 0 && filtered.every((b) => selectedIds.has(b.id));

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Link
            href="/split-bill"
            className="w-10 h-10 shrink-0 rounded-full border border-[#E5E7EB] dark:border-[#27272A] bg-white dark:bg-[#121215] flex items-center justify-center hover:bg-[#F8F9FA] dark:hover:bg-[#1A1A20] transition-colors"
            aria-label={t.common.back}
            title={t.common.back}
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-[#0F172A] dark:text-[#FAFAFA] truncate">{t.splitBill.history}</h1>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8] truncate">{bills.length} {t.splitBill.title.toLowerCase()}</p>
          </div>
        </div>
        {bills.length > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            {selectMode ? (
              <>
                <button
                  type="button"
                  onClick={selectAllFiltered}
                  className="h-9 px-3 rounded-full border border-[#E5E7EB] dark:border-[#27272A] bg-white dark:bg-[#121215] text-xs font-semibold text-[#0F172A] dark:text-[#FAFAFA] hover:bg-[#F8F9FA] dark:hover:bg-[#1A1A20] transition-colors"
                >
                  {allFilteredSelected ? (language === "id" ? "Batal pilih semua" : "Deselect all") : (language === "id" ? "Pilih semua" : "Select all")}
                </button>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="w-9 h-9 rounded-full border border-[#E5E7EB] dark:border-[#27272A] bg-white dark:bg-[#121215] flex items-center justify-center text-[#64748B] hover:bg-[#F8F9FA] dark:hover:bg-[#1A1A20] transition-colors"
                  aria-label={t.common.cancel}
                  title={t.common.cancel}
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setSelectMode(true)}
                className="h-9 px-3 rounded-full border border-[#E5E7EB] dark:border-[#27272A] bg-white dark:bg-[#121215] text-xs font-semibold text-[#0F172A] dark:text-[#FAFAFA] hover:bg-[#F8F9FA] dark:hover:bg-[#1A1A20] transition-colors"
              >
                {language === "id" ? "Pilih" : "Select"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Filter status */}
      {bills.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {filters.map((f) => {
            const count = f.id === "all" ? bills.length : bills.filter((b) => b.status === f.id).length;
            if (count === 0 && f.id !== "all") return null;
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={cn(
                  "shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                  active
                    ? "bg-[#0F172A] text-white dark:bg-[#FAFAFA] dark:text-[#0F172A] border-transparent"
                    : "bg-white dark:bg-[#121215] border-[#E5E7EB] dark:border-[#27272A] text-[#64748B] dark:text-[#94A3B8] hover:border-[#94A3B8]",
                )}
              >
                {f.label}
                <span className={cn("font-mono text-[10px]", active ? "opacity-70" : "opacity-60")}>{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {bills.length === 0 ? (
        <div className="rounded-xl border border-[#E5E7EB] dark:border-[#27272A] bg-white dark:bg-[#121215] p-8 text-center">
          <Split className="w-8 h-8 mx-auto text-[#94A3B8] mb-2" />
          <p className="text-sm font-semibold text-[#0F172A] dark:text-[#FAFAFA]">{t.splitBill.noBills}</p>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-1">{t.splitBill.noBillsDesc}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#CBD5E1] dark:border-[#334155] bg-white dark:bg-[#121215] p-8 text-center">
          <p className="text-sm font-semibold text-[#0F172A] dark:text-[#FAFAFA]">
            {language === "id" ? "Tidak ada patungan di filter ini" : "No split bills in this filter"}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((b) => {
            const selected = selectedIds.has(b.id);
            return (
              <div
                key={b.id}
                className={cn(
                  "group flex items-center gap-3 p-3.5 rounded-2xl border bg-white dark:bg-[#121215] transition-colors",
                  selected
                    ? "border-[#0F172A] dark:border-[#FAFAFA]"
                    : "border-[#E5E7EB] dark:border-[#27272A] hover:border-[#CBD5E1] dark:hover:border-[#334155]",
                )}
              >
                {selectMode ? (
                  <button
                    type="button"
                    onClick={() => toggleSelect(b.id)}
                    className="w-10 h-10 shrink-0 flex items-center justify-center transition-colors"
                    aria-label={selected ? (language === "id" ? "Batal pilih" : "Deselect") : (language === "id" ? "Pilih" : "Select")}
                  >
                    <span
                      className={cn(
                        "w-5 h-5 rounded-[5px] border flex items-center justify-center transition-colors",
                        selected
                          ? "bg-[#0F172A] border-[#0F172A] text-white dark:bg-[#FAFAFA] dark:border-[#FAFAFA] dark:text-[#0F172A]"
                          : "border-[#94A3B8] dark:border-[#64748B] bg-transparent",
                      )}
                    >
                      {selected && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                    </span>
                  </button>
                ) : (
                  <span className="w-10 h-10 shrink-0 rounded-xl bg-[#F1F3F5] dark:bg-[#1A1A20] flex items-center justify-center text-[#64748B] dark:text-[#94A3B8]">
                    <Receipt className="w-4 h-4" />
                  </span>
                )}
                <Link
                  href={selectMode ? "#" : `/split-bill/${b.id}`}
                  onClick={(e) => {
                    if (selectMode) {
                      e.preventDefault();
                      toggleSelect(b.id);
                    }
                  }}
                  className="flex-1 min-w-0"
                >
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-sm font-bold text-[#0F172A] dark:text-[#FAFAFA] truncate">
                      {b.title || "Split Bill"}
                    </p>
                    <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold",
                      b.status === "balanced" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-[#F1F3F5] text-[#64748B] dark:bg-[#1A1A20] dark:text-[#94A3B8]")}>
                      {b.status === "balanced" ? t.splitBill.balanced : t.splitBill.draft}
                    </span>
                    {b.split_mode === "equal" && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold border border-[#E5E7EB] dark:border-[#27272A] text-[#64748B] dark:text-[#94A3B8]">
                        {t.splitBill.equalSplit}
                      </span>
                    )}
                    {b.my_recorded_transaction_id && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-[#F1F3F5] text-[#0F172A] dark:bg-[#27272A] dark:text-[#FAFAFA]">{t.splitBill.recorded}</span>
                    )}
                  </div>
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-1">
                    {(b.bill_date
                      ? new Date(b.bill_date + "T00:00:00").toLocaleDateString(language === "id" ? "id-ID" : "en-US", { day: "numeric", month: "short", year: "numeric" })
                      : "-")} • {formatCurrency(Number(b.grand_total_amount) || 0, b.currency)}
                  </p>
                </Link>
                {!selectMode && (
                  <button onClick={() => setPendingDelete(b)} className="p-2 text-[#94A3B8] hover:text-[#E11D48] cursor-pointer shrink-0" title={t.splitBill.delete} aria-label={t.splitBill.delete}><Trash2 className="w-4 h-4" /></button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {selectMode && selectedIds.size > 0 && (
        <div className="sticky bottom-3 mt-2 flex items-center justify-between gap-3 rounded-2xl border border-[#E5E7EB] dark:border-[#27272A] bg-white/95 dark:bg-[#121215]/95 backdrop-blur p-3 shadow-sm">
          <p className="text-sm font-semibold text-[#0F172A] dark:text-[#FAFAFA]">
            {selectedIds.size} {language === "id" ? "dipilih" : "selected"}
          </p>
          <button
            type="button"
            onClick={() => setShowBulkDelete(true)}
            className="h-9 px-4 rounded-full bg-[#E11D48] text-white text-xs font-bold hover:bg-[#BE123C] transition-colors"
          >
            {language === "id" ? "Hapus terpilih" : "Delete selected"}
          </button>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!pendingDelete}
        onClose={() => !isDeleting && setPendingDelete(null)}
        onConfirm={() => void handleDelete()}
        title={t.splitBill.deleteBillTitle}
        message={t.splitBill.deleteBillConfirm}
        confirmText={t.splitBill.delete}
        cancelText={t.common.cancel}
        variant="danger"
        isLoading={isDeleting}
      />

      <ConfirmDialog
        isOpen={showBulkDelete}
        onClose={() => !isBulkDeleting && setShowBulkDelete(false)}
        onConfirm={() => void handleBulkDelete()}
        title={t.splitBill.deleteBillTitle}
        message={
          language === "id"
            ? `Hapus ${selectedIds.size} split bill yang dipilih? Tindakan ini tidak bisa dibatalkan.`
            : `Delete ${selectedIds.size} selected split bills? This action cannot be undone.`
        }
        confirmText={t.splitBill.delete}
        cancelText={t.common.cancel}
        variant="danger"
        isLoading={isBulkDeleting}
      />
    </div>
  );
}
