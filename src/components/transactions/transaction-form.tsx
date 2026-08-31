"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import {
  Account,
  Category,
  EnrichedTransaction,
  TransactionType,
} from "@/types/database";
import { createTransaction, updateTransaction } from "@/actions/transactions";
import { DatePicker } from "@/components/ui/date-picker";
import { DynamicIcon } from "@/components/ui/dynamic-icon";
import { useLanguage } from "@/lib/i18n/language-context";
import { formatCurrency } from "@/lib/utils/currency";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronDown,
  ListPlus,
  AlignLeft,
  Plus,
  Trash2,
  Delete,
  Pin,
  X,
  Hash,
  Check,
  AlertCircle,
  Camera,
  Loader2,
  Calculator,
  Search,
} from "lucide-react";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "cmdk";
import { cn } from "@/lib/utils/cn";
import { toast } from "sonner";
import { savePinnedTemplate } from "@/lib/storage/pinned-templates";
import { scanReceipt } from "@/lib/ocr/receipt-scanner";
import { getDefaultAccountId } from "@/lib/storage/default-account";
import { localDateToISO, getLocalDateString } from "@/lib/utils/date";

interface ItemRow {
  name: string;
  price: string;
}

interface TransactionFormProps {
  initialData?: EnrichedTransaction | null;
  accounts: Account[];
  categories: Category[];
  onSuccess?: () => void;
  /**
   * Map "{accountId}_{type}" -> categoryId paling sering dipakai.
   * HANYA dipakai untuk auto-suggest di mode CREATE (initialData kosong).
   * Mode edit tidak pernah auto-suggest kategori, walau akun diganti,
   * supaya kategori transaksi lama yang sedang diedit tidak berubah
   * tanpa disadari user.
   */
  mostUsedCategoryByAccount?: Record<string, string>;
}

function parseTransactionDescription(
  rawDesc?: string | null,
  rawTags?: string[],
) {
  if (!rawDesc && (!rawTags || rawTags.length === 0)) {
    return { baseDescription: "", items: [], memo: "", tags: [] };
  }

  let text = rawDesc || "";
  const items: ItemRow[] = [];
  let memo = "";
  const tagsSet = new Set<string>(rawTags || []);

  // Extract [Items: ...]
  const itemsMatch = text.match(/\[Items:\s*([^\]]+)\]/);
  if (itemsMatch) {
    const rawItems = itemsMatch[1].split(",");
    for (const item of rawItems) {
      const parts = item.split("(");
      const name = parts[0]?.trim() || "";
      let price = "";
      if (parts[1]) {
        price = parts[1].replace(/[^0-9.]/g, "");
      }
      if (name) {
        items.push({ name, price });
      }
    }
    text = text.replace(itemsMatch[0], "").trim();
  }

  // Extract [Memo: ...]
  const memoMatch = text.match(/\[Memo:\s*([^\]]+)\]/);
  if (memoMatch) {
    memo = memoMatch[1].trim();
    text = text.replace(memoMatch[0], "").trim();
  }

  // Extract inline hashtags #tag
  const inlineTags = text.match(/#(\w+)/g);
  if (inlineTags) {
    inlineTags.forEach((t) => {
      tagsSet.add(t.replace("#", "").toLowerCase());
    });
    text = text.replace(/#(\w+)/g, "").trim();
  }

  return {
    baseDescription: text.replace(/\s+/g, " ").trim(),
    items,
    memo,
    tags: Array.from(tagsSet),
  };
}

export function TransactionForm({
  initialData,
  accounts,
  categories,
  onSuccess,
  mostUsedCategoryByAccount = {},
}: TransactionFormProps) {
  const router = useRouter();
  const { language, t } = useLanguage();
  const isEditing = !!initialData;

  const parsed = parseTransactionDescription(
    initialData?.description,
    initialData?.tags,
  );

  const [type, setType] = useState<TransactionType>(
    initialData?.type || "expense",
  );
  const [amountStr, setAmountStr] = useState<string>(
    initialData?.amount ? String(Math.round(Number(initialData.amount))) : "0",
  );
  const [isNumpadOpen, setIsNumpadOpen] = useState(false);

  const initialAccountId =
    initialData?.account_id ||
    (accounts.find((a) => a.id === getDefaultAccountId())?.id ??
      accounts[0]?.id ??
      "");

  const [selectedAccountId, setSelectedAccountId] =
    useState<string>(initialAccountId);

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(() => {
    // Edit mode: always keep the transaction's own category, never auto-suggest.
    if (initialData?.category_id) return initialData.category_id;

    // Create mode: prefer the most-used category for this account+type,
    // fall back to the first category matching the type.
    const txType = initialData?.type || "expense";
    const matchingCats = categories.filter((c) => c.type === txType);
    const suggestedId =
      mostUsedCategoryByAccount[`${initialAccountId}_${txType}`];
    const suggestedStillValid =
      suggestedId && matchingCats.some((c) => c.id === suggestedId);

    return suggestedStillValid ? suggestedId : (matchingCats[0]?.id ?? "");
  });
  const [description, setDescription] = useState<string>(
    parsed.baseDescription,
  );
  const [txDate, setTxDate] = useState<string>(
    initialData?.transaction_date
      ? getLocalDateString(initialData.transaction_date)
      : getLocalDateString(),
  );
  const [isPinned, setIsPinned] = useState<boolean>(false);

  // Sub-items breakdown
  const [items, setItems] = useState<ItemRow[]>(parsed.items);
  const [showItemsBreakdown, setShowItemsBreakdown] = useState<boolean>(
    parsed.items.length > 0,
  );

  // Free text memo
  const [freeTextMemo, setFreeTextMemo] = useState<string>(parsed.memo);
  const [showFreeMemo, setShowFreeMemo] = useState<boolean>(!!parsed.memo);

  // Tags (#tags)
  const [tags, setTags] = useState<string[]>(parsed.tags);
  const [showTags, setShowTags] = useState<boolean>(parsed.tags.length > 0);
  const [tagInput, setTagInput] = useState<string>("");

  // OCR Scan State
  const [isScanning, setIsScanning] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<number>(0);
  const [ocrStatus, setOcrStatus] = useState<string>("");
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Popover controls
  const [isAccountPopoverOpen, setIsAccountPopoverOpen] = useState(false);
  const [isCategoryPopoverOpen, setIsCategoryPopoverOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Receipt OCR File Handler
  const handleReceiptUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    setOcrProgress(10);
    setOcrStatus(t.quickAdd.scanningReceipt);

    try {
      const parsed = await scanReceipt(file, (pct, status) => {
        setOcrProgress(pct);
        setOcrStatus(status);
      });

      if (parsed.amount > 0) {
        setAmountStr(String(Math.round(parsed.amount)));
      }
      if (parsed.description) {
        setDescription(parsed.description);
      }
      if (parsed.date) {
        setTxDate(parsed.date);
      }
      if (parsed.items && parsed.items.length > 0) {
        setItems(parsed.items);
        setShowItemsBreakdown(true);
      }

      toast.success(t.quickAdd.scanSuccess);
    } catch (err: any) {
      console.error("OCR Error:", err);
      toast.error(t.quickAdd.scanFailed);
    } finally {
      setIsScanning(false);
      setOcrProgress(0);
      setOcrStatus("");
      if (e.target) e.target.value = "";
    }
  };

  const activeAccount =
    accounts.find((a) => a.id === selectedAccountId) || accounts[0];
  const activeCategory =
    categories.find((c) => c.id === selectedCategoryId) || categories[0];
  const currentCurrency = activeAccount?.currency || "IDR";

  const filteredCategories = categories.filter((c) => c.type === type);

  // Sub-items calculation
  const itemsTotal = items.reduce((sum, item) => {
    const p = parseFloat(item.price) || 0;
    return sum + p;
  }, 0);

  // Numeric amount is strictly driven by the main amountStr input/keypad
  const numericAmount = parseFloat(amountStr) || 0;
  const remainingAmount = numericAmount - itemsTotal;
  const isItemsExceeding =
    showItemsBreakdown &&
    items.length > 0 &&
    itemsTotal > numericAmount &&
    numericAmount > 0;
  const isItemsMatching =
    showItemsBreakdown &&
    items.length > 0 &&
    itemsTotal === numericAmount &&
    numericAmount > 0;
  const hasRemainingUnitemized =
    showItemsBreakdown &&
    items.length > 0 &&
    remainingAmount > 0 &&
    numericAmount > 0;

  // Quick Keypad Press (Always enabled so user can type main amount freely)
  const handleKeypadPress = (val: string) => {
    setError(null);
    if (amountStr === "0") {
      if (val === "000") return;
      setAmountStr(val);
    } else {
      if (amountStr.length >= 12) return;
      setAmountStr((prev) => prev + val);
    }
  };

  const handleKeypadBackspace = () => {
    setError(null);
    if (amountStr.length <= 1) {
      setAmountStr("0");
    } else {
      setAmountStr((prev) => prev.slice(0, -1));
    }
  };

  // Type change
  const handleTypeChange = (newType: TransactionType) => {
    setType(newType);

    // Edit mode: don't touch the category when the type changes.
    if (isEditing) return;

    const matchingCats = categories.filter((c) => c.type === newType);
    const suggestedId =
      mostUsedCategoryByAccount[`${selectedAccountId}_${newType}`];
    const suggestedStillValid =
      suggestedId && matchingCats.some((c) => c.id === suggestedId);

    const defaultCategoryId = suggestedStillValid
      ? suggestedId
      : matchingCats[0]?.id;

    if (defaultCategoryId) {
      setSelectedCategoryId(defaultCategoryId);
    }
  };

  // Sub-items CRUD
  const handleAddItem = () => {
    setItems((prev) => [...prev, { name: "", price: "" }]);
  };

  const handleUpdateItem = (
    index: number,
    field: keyof ItemRow,
    value: string,
  ) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Save / Update Transaction
  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (numericAmount <= 0) {
      setError(t.quickAdd.nominal + " > 0");
      return;
    }

    if (!selectedAccountId || !activeAccount) {
      setError(t.quickAdd.selectAccount);
      return;
    }

    if (!selectedCategoryId) {
      setError(t.quickAdd.selectCategory);
      return;
    }

    if (
      showItemsBreakdown &&
      items.length > 0 &&
      itemsTotal > numericAmount &&
      numericAmount > 0
    ) {
      setError(
        `${t.quickAdd.itemsExceedWarning} ${formatCurrency(itemsTotal - numericAmount, currentCurrency)}`,
      );
      return;
    }

    // Client-side Strict Non-Negative Balance Guard for Expense
    if (!isEditing && type === "expense" && activeAccount) {
      const currentBal = Number(activeAccount.current_balance) || 0;
      if (currentBal - numericAmount < 0) {
        const err =
          language === "en"
            ? `Insufficient balance in ${activeAccount.name} (Available: ${formatCurrency(currentBal, activeAccount.currency)}, Required: ${formatCurrency(numericAmount, activeAccount.currency)})`
            : `Saldo ${activeAccount.name} tidak mencukupi (Tersedia: ${formatCurrency(currentBal, activeAccount.currency)}, Dibutuhkan: ${formatCurrency(numericAmount, activeAccount.currency)})`;
        setError(err);
        toast.error(
          t.transactions.insufficientBalance ||
            (language === "en"
              ? "Insufficient Balance"
              : "Saldo Tidak Mencukupi"),
          { description: err },
        );
        return;
      }
    }

    setIsLoading(true);
    setError(null);

    // Build compound description if items or memo exist
    const defaultTypeLabel =
      type === "expense"
        ? language === "en"
          ? "Expense"
          : "Pengeluaran"
        : language === "en"
          ? "Income"
          : "Pemasukan";
    let finalDesc =
      description.trim() || activeCategory?.name || defaultTypeLabel;

    if (showItemsBreakdown && items.length > 0) {
      const validItems = items.filter(
        (i) => i.name.trim() && parseFloat(i.price) > 0,
      );
      if (validItems.length > 0) {
        const itemsSummary = validItems
          .map(
            (i) =>
              `${i.name.trim()} (${formatCurrency(parseFloat(i.price), currentCurrency)})`,
          )
          .join(", ");
        finalDesc += ` [Items: ${itemsSummary}]`;
      }
    }

    if (showFreeMemo && freeTextMemo.trim()) {
      finalDesc += ` [Memo: ${freeTextMemo.trim()}]`;
    }

    try {
      const finalTags = [...tags];
      if (tagInput.trim()) {
        const clean = tagInput.replace(/^#/, "").toLowerCase().trim();
        if (clean && !finalTags.includes(clean)) {
          finalTags.push(clean);
        }
      }

      const payload = {
        accountId: selectedAccountId,
        categoryId: selectedCategoryId,
        type,
        amount: numericAmount,
        currency: currentCurrency,
        description: finalDesc,
        tags: finalTags.length > 0 ? finalTags : undefined,
        transactionDate: localDateToISO(txDate),
      };

      if (isPinned) {
        savePinnedTemplate({
          name:
            description.trim() ||
            activeCategory?.name ||
            (type === "expense" ? "Pengeluaran" : "Pemasukan"),
          accountId: selectedAccountId,
          accountName: activeAccount?.name,
          categoryId: selectedCategoryId,
          categoryName: activeCategory?.name,
          categoryIcon: activeCategory?.icon,
          type,
          amount: numericAmount,
          currency: currentCurrency,
          description: finalDesc,
        });
      }

      if (isEditing && initialData) {
        const res = await updateTransaction(initialData.id, payload);
        if (res.error) {
          setError(res.error);
          toast.error(
            t.transactions.updateFailed ||
              (language === "en"
                ? "Failed to Update Transaction"
                : "Gagal Mengubah Transaksi"),
            { description: res.error },
          );
          return;
        }
        toast.success(
          language === "en"
            ? "Transaction updated successfully"
            : "Transaksi berhasil diperbarui",
        );
      } else {
        const res = await createTransaction(payload);
        if (res.error) {
          setError(res.error);
          toast.error(
            t.transactions.createFailed ||
              (language === "en"
                ? "Failed to Record Transaction"
                : "Gagal Mencatat Transaksi"),
            { description: res.error },
          );
          return;
        }
        toast.success(
          language === "en"
            ? "Transaction recorded successfully"
            : "Transaksi berhasil dicatat",
        );
      }

      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/transactions");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to save transaction");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-4">
      {error && (
        <div className="p-3 rounded-lg bg-[#FFF1F2] dark:bg-[#881337]/20 border border-[#FECDD3] dark:border-[#9F1239]/40 text-xs text-[#E11D48] flex items-center justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-[#E11D48] hover:opacity-80"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 1. Transaction Type Toggle */}
      <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[#F1F3F5] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A]">
        <button
          type="button"
          onClick={() => handleTypeChange("expense")}
          className={cn(
            "flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer",
            type === "expense"
              ? "bg-[#E11D48] text-white shadow-xs"
              : "text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#FAFAFA]",
          )}
        >
          <ArrowDownRight className="w-4 h-4" />
          <span>{t.quickAdd.expense}</span>
        </button>

        <button
          type="button"
          onClick={() => handleTypeChange("income")}
          className={cn(
            "flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer",
            type === "income"
              ? "bg-[#0D9488] text-white shadow-xs"
              : "text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#FAFAFA]",
          )}
        >
          <ArrowUpRight className="w-4 h-4" />
          <span>{t.quickAdd.income}</span>
        </button>
      </div>

      {/* 2. Amount Input & Pin Shortcut (Click to Open Numpad) */}
      <div
        className={cn(
          "relative rounded-xl bg-white dark:bg-[#121215] border shadow-2xs overflow-hidden transition-all group",
          isNumpadOpen
            ? "border-[#0F172A] dark:border-[#FAFAFA] ring-2 ring-[#0F172A]/10 dark:ring-[#FAFAFA]/10"
            : "border-[#E5E7EB] dark:border-[#27272A]",
        )}
      >
        <button
          type="button"
          onClick={() => setIsNumpadOpen(!isNumpadOpen)}
          className="w-full p-3.5 sm:p-4 flex flex-col gap-1 text-left cursor-pointer hover:bg-[#F8F9FA] dark:hover:bg-[#16161A] transition-colors"
        >
          <div className="flex items-center justify-between pr-8">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
              {t.quickAdd.nominal}
            </span>

            <Calculator
              className={cn(
                "w-4 h-4 transition-colors",
                isNumpadOpen
                  ? "text-[#0F172A] dark:text-[#FAFAFA]"
                  : "text-[#94A3B8] group-hover:text-blue-500",
              )}
            />
          </div>

          <div className="flex items-baseline gap-2 pt-0.5">
            <span className="text-xl sm:text-2xl font-bold text-[#0F172A] dark:text-[#F8FAFC]">
              {currentCurrency}
            </span>
            <span
              className={cn(
                "flex-1 min-w-0 text-2xl sm:text-3xl font-mono font-bold tracking-tight truncate",
                numericAmount > 0
                  ? "text-[#0F172A] dark:text-[#F8FAFC]"
                  : "text-[#94A3B8]",
              )}
            >
              {formatCurrency(numericAmount, currentCurrency)}
            </span>
          </div>
        </button>

        {/* Pin button on top right */}
        <div className="absolute top-2.5 right-2.5 z-10">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsPinned(!isPinned);
            }}
            className={cn(
              "p-1.5 rounded-md transition-colors cursor-pointer",
              isPinned
                ? "text-amber-500 bg-amber-50 dark:bg-amber-950/40"
                : "text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#FAFAFA]",
            )}
            title={isPinned ? "Sematkan aktif" : "Sematkan transaksi ini"}
          >
            <Pin className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Conditionally render: If Numpad Open -> In-Place Keypad Grid; Else -> Form Fields */}
      {isNumpadOpen ? (
        <div className="flex flex-col gap-2 pt-1 animate-in fade-in-50 zoom-in-98 duration-150">
          <div className="grid grid-cols-4 gap-1.5">
            {["1", "2", "3"].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => handleKeypadPress(n)}
                className="py-3.5 sm:py-4 rounded-xl bg-[#F1F3F5] dark:bg-[#1A1A20] font-mono font-bold text-base sm:text-lg hover:bg-[#E9ECEF] dark:hover:bg-[#26262E] text-[#0F172A] dark:text-[#F8FAFC] border border-[#E5E7EB] dark:border-[#27272A] active:scale-95 transition-all cursor-pointer select-none"
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              onClick={handleKeypadBackspace}
              className="py-3.5 sm:py-4 rounded-xl bg-[#F1F3F5] dark:bg-[#1A1A20] flex items-center justify-center text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#FAFAFA] hover:bg-[#E9ECEF] dark:hover:bg-[#26262E] border border-[#E5E7EB] dark:border-[#27272A] active:scale-95 transition-all cursor-pointer select-none"
            >
              <Delete className="w-5 h-5" />
            </button>

            {["4", "5", "6"].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => handleKeypadPress(n)}
                className="py-3.5 sm:py-4 rounded-xl bg-[#F1F3F5] dark:bg-[#1A1A20] font-mono font-bold text-base sm:text-lg hover:bg-[#E9ECEF] dark:hover:bg-[#26262E] text-[#0F172A] dark:text-[#F8FAFC] border border-[#E5E7EB] dark:border-[#27272A] active:scale-95 transition-all cursor-pointer select-none"
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              onClick={() => handleKeypadPress("000")}
              className="py-3.5 sm:py-4 rounded-xl bg-[#F1F3F5] dark:bg-[#1A1A20] font-mono font-bold text-xs sm:text-sm hover:bg-[#E9ECEF] dark:hover:bg-[#26262E] text-[#0F172A] dark:text-[#F8FAFC] border border-[#E5E7EB] dark:border-[#27272A] active:scale-95 transition-all cursor-pointer select-none"
            >
              .000
            </button>

            {["7", "8", "9"].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => handleKeypadPress(n)}
                className="py-3.5 sm:py-4 rounded-xl bg-[#F1F3F5] dark:bg-[#1A1A20] font-mono font-bold text-base sm:text-lg hover:bg-[#E9ECEF] dark:hover:bg-[#26262E] text-[#0F172A] dark:text-[#F8FAFC] border border-[#E5E7EB] dark:border-[#27272A] active:scale-95 transition-all cursor-pointer select-none"
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setAmountStr("0")}
              className="py-3.5 sm:py-4 rounded-xl bg-[#FFF1F2] dark:bg-[#881337]/20 text-[#E11D48] font-mono font-bold text-sm hover:bg-[#FFE4E6] dark:hover:bg-[#881337]/40 border border-[#FECDD3] dark:border-[#9F1239]/40 active:scale-95 transition-all cursor-pointer select-none"
            >
              C
            </button>

            <button
              type="button"
              onClick={() => handleKeypadPress("00")}
              className="py-3.5 sm:py-4 rounded-xl bg-[#F1F3F5] dark:bg-[#1A1A20] font-mono font-bold text-sm hover:bg-[#E9ECEF] dark:hover:bg-[#26262E] text-[#0F172A] dark:text-[#F8FAFC] border border-[#E5E7EB] dark:border-[#27272A] active:scale-95 transition-all cursor-pointer select-none"
            >
              00
            </button>
            <button
              type="button"
              onClick={() => handleKeypadPress("0")}
              className="py-3.5 sm:py-4 rounded-xl bg-[#F1F3F5] dark:bg-[#1A1A20] font-mono font-bold text-base sm:text-lg hover:bg-[#E9ECEF] dark:hover:bg-[#26262E] text-[#0F172A] dark:text-[#F8FAFC] border border-[#E5E7EB] dark:border-[#27272A] active:scale-95 transition-all cursor-pointer select-none"
            >
              0
            </button>
            <button
              type="button"
              onClick={() => setIsNumpadOpen(false)}
              className="col-span-2 py-3.5 sm:py-4 rounded-xl bg-[#0F172A] dark:bg-[#FAFAFA] text-white dark:text-[#0F172A] font-bold text-xs flex items-center justify-center gap-1.5 hover:opacity-90 active:scale-95 shadow-md transition-all cursor-pointer select-none"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>{language === "en" ? "Done" : "Selesai"}</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* 3. Date Picker & Clear Shortcut */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="date"
                value={txDate}
                onChange={(e) => setTxDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:border-[#0F172A] dark:focus:border-[#FAFAFA]"
              />
            </div>
            {txDate !== getLocalDateString() && (
              <button
                type="button"
                onClick={() => setTxDate(getLocalDateString())}
                className="p-2 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#FAFAFA]"
                title="Set to today"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* 4. Account Picker */}
          <PopoverPrimitive.Root
            open={isAccountPopoverOpen}
            onOpenChange={setIsAccountPopoverOpen}
          >
            <PopoverPrimitive.Trigger asChild>
              <button
                type="button"
                className="w-full flex items-center justify-between p-3 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] text-xs hover:border-[#0F172A] dark:hover:border-[#FAFAFA] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-6 h-6 rounded bg-[#F1F3F5] dark:bg-[#1A1A20] text-[#0F172A] dark:text-[#FAFAFA] flex items-center justify-center shrink-0">
                    <DynamicIcon
                      name={activeAccount?.icon || "Wallet"}
                      className="w-3.5 h-3.5"
                    />
                  </div>
                  <div className="flex flex-col text-left min-w-0">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-[#94A3B8]">
                      {t.quickAdd.account}
                    </span>
                    <span className="font-bold text-[#0F172A] dark:text-[#F8FAFC] truncate">
                      {activeAccount?.name || t.quickAdd.selectAccount}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 text-[#64748B] dark:text-[#94A3B8]">
                  <span className="text-[10px] font-bold">
                    ({activeAccount?.currency})
                  </span>
                  <ChevronDown className="w-4 h-4" />
                </div>
              </button>
            </PopoverPrimitive.Trigger>

            <PopoverPrimitive.Portal>
              <PopoverPrimitive.Content
                align="start"
                sideOffset={4}
                className="z-50 w-[calc(100vw-2.5rem)] max-w-sm p-0 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] shadow-xl overflow-hidden animate-in fade-in-0 zoom-in-95"
              >
                <Command
                  className="flex flex-col bg-transparent"
                  filter={(value, search) =>
                    value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
                  }
                >
                  <div className="flex items-center gap-2 px-3 border-b border-[#E5E7EB] dark:border-[#27272A]">
                    <Search className="w-4 h-4 text-[#94A3B8] shrink-0" />
                    <CommandInput
                      autoFocus
                      placeholder={
                        language === "en" ? "Search account..." : "Cari akun..."
                      }
                      className="flex-1 py-3 bg-transparent text-sm text-[#0F172A] dark:text-[#F8FAFC] placeholder:text-[#94A3B8] focus:outline-none"
                    />
                  </div>
                  <CommandList className="max-h-64 overflow-y-auto p-1.5">
                    <CommandEmpty className="py-6 text-center text-xs text-[#94A3B8]">
                      {language === "en"
                        ? "No account found."
                        : "Akun tidak ditemukan."}
                    </CommandEmpty>
                    <CommandGroup>
                      {accounts.map((acc) => (
                        <CommandItem
                          key={acc.id}
                          value={acc.name}
                          onSelect={() => {
                            setSelectedAccountId(acc.id);

                            // Edit mode: never auto-suggest category on account
                            // change — user may just be moving the transaction
                            // to a different account, category stays as-is.
                            if (!isEditing) {
                              const matchingCats = categories.filter(
                                (c) => c.type === type,
                              );
                              const suggestedId =
                                mostUsedCategoryByAccount[`${acc.id}_${type}`];
                              const suggestedStillValid =
                                suggestedId &&
                                matchingCats.some((c) => c.id === suggestedId);
                              const defaultCategoryId = suggestedStillValid
                                ? suggestedId
                                : matchingCats[0]?.id;

                              if (defaultCategoryId) {
                                setSelectedCategoryId(defaultCategoryId);
                              }
                            }

                            setIsAccountPopoverOpen(false);
                          }}
                          className={cn(
                            "flex items-center justify-between gap-2 p-3 rounded-lg text-sm font-medium cursor-pointer transition-colors",
                            acc.id === selectedAccountId
                              ? "bg-[#0F172A] text-white dark:bg-[#FAFAFA] dark:text-[#0F172A]"
                              : "text-[#0F172A] dark:text-[#F8FAFC] data-[selected=true]:bg-[#F1F3F5] dark:data-[selected=true]:bg-[#1A1A20]",
                          )}
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <DynamicIcon
                              name={acc.icon || "Wallet"}
                              className="w-4 h-4 shrink-0"
                            />
                            <span className="truncate">{acc.name}</span>
                          </div>
                          <span className="text-xs font-mono opacity-80 shrink-0 ml-1">
                            {acc.currency}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverPrimitive.Content>
            </PopoverPrimitive.Portal>
          </PopoverPrimitive.Root>

          {/* 5. Category Picker */}
          <PopoverPrimitive.Root
            open={isCategoryPopoverOpen}
            onOpenChange={setIsCategoryPopoverOpen}
          >
            <PopoverPrimitive.Trigger asChild>
              <button
                type="button"
                className="w-full flex items-center justify-between p-3 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] text-xs hover:border-[#0F172A] dark:hover:border-[#FAFAFA] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="w-6 h-6 rounded flex items-center justify-center shrink-0 text-white"
                    style={{
                      backgroundColor: activeCategory?.color || "#3B82F6",
                    }}
                  >
                    <DynamicIcon
                      name={activeCategory?.icon || "Tag"}
                      className="w-3.5 h-3.5"
                    />
                  </div>
                  <div className="flex flex-col text-left min-w-0">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-[#94A3B8]">
                      {t.quickAdd.category}
                    </span>
                    <span className="font-bold text-[#0F172A] dark:text-[#F8FAFC] truncate">
                      {activeCategory?.name || t.quickAdd.selectCategory}
                    </span>
                  </div>
                </div>
                <ChevronDown className="w-4 h-4 text-[#64748B] dark:text-[#94A3B8] shrink-0" />
              </button>
            </PopoverPrimitive.Trigger>

            <PopoverPrimitive.Portal>
              <PopoverPrimitive.Content
                align="start"
                sideOffset={4}
                className="z-50 w-[calc(100vw-2.5rem)] max-w-sm p-0 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] shadow-xl overflow-hidden animate-in fade-in-0 zoom-in-95"
              >
                <Command
                  className="flex flex-col bg-transparent"
                  filter={(value, search) =>
                    value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
                  }
                >
                  <div className="flex items-center gap-2 px-3 border-b border-[#E5E7EB] dark:border-[#27272A]">
                    <Search className="w-4 h-4 text-[#94A3B8] shrink-0" />
                    <CommandInput
                      autoFocus
                      placeholder={
                        language === "en"
                          ? "Search category..."
                          : "Cari kategori..."
                      }
                      className="flex-1 py-3 bg-transparent text-sm text-[#0F172A] dark:text-[#F8FAFC] placeholder:text-[#94A3B8] focus:outline-none"
                    />
                  </div>
                  <CommandList className="max-h-64 overflow-y-auto p-1.5">
                    <CommandEmpty className="py-6 text-center text-xs text-[#94A3B8]">
                      {language === "en"
                        ? "No category found."
                        : "Kategori tidak ditemukan."}
                    </CommandEmpty>
                    <CommandGroup>
                      {filteredCategories.map((c) => (
                        <CommandItem
                          key={c.id}
                          value={c.name}
                          onSelect={() => {
                            setSelectedCategoryId(c.id);
                            setIsCategoryPopoverOpen(false);
                          }}
                          className={cn(
                            "flex items-center gap-2.5 p-3 rounded-lg text-sm font-medium cursor-pointer transition-colors",
                            c.id === selectedCategoryId
                              ? "bg-[#0F172A] text-white dark:bg-[#FAFAFA] dark:text-[#0F172A]"
                              : "text-[#0F172A] dark:text-[#F8FAFC] data-[selected=true]:bg-[#F1F3F5] dark:data-[selected=true]:bg-[#1A1A20]",
                          )}
                        >
                          <div
                            className="w-5 h-5 rounded flex items-center justify-center shrink-0 text-white"
                            style={{
                              backgroundColor: c.color || "#3B82F6",
                            }}
                          >
                            <DynamicIcon
                              name={c.icon || "Tag"}
                              className="w-3 h-3"
                            />
                          </div>
                          <span className="truncate">{c.name}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverPrimitive.Content>
            </PopoverPrimitive.Portal>
          </PopoverPrimitive.Root>

          {/* 6. Base Description Input (Full Width) */}
          <div className="flex flex-col gap-2">
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t.quickAdd.notePlaceholder}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0F172A] dark:focus:border-[#FAFAFA]"
            />

            {/* Hidden File Input for Receipt Photo */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleReceiptUpload}
            />

            {/* OCR Scanning Status Banner */}
            {isScanning && (
              <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 flex items-center justify-between gap-2 animate-pulse">
                <div className="flex items-center gap-2 min-w-0">
                  <Loader2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 animate-spin shrink-0" />
                  <span className="text-xs font-medium text-indigo-900 dark:text-indigo-200 truncate">
                    {ocrStatus || t.quickAdd.scanningReceipt}
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
                  {ocrProgress}%
                </span>
              </div>
            )}

            {/* Action Toolbar Grid (4 Columns: Scan, Items, Memo, Tags) */}
            <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
              {/* OCR Scan Button */}
              <button
                type="button"
                disabled={isScanning}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "py-2 px-1.5 rounded-xl border text-[11px] sm:text-xs font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer select-none",
                  isScanning
                    ? "opacity-60 cursor-not-allowed bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-950/40 dark:border-indigo-800"
                    : "bg-[#F8F9FA] dark:bg-[#1A1A20] text-[#0F172A] dark:text-[#F8FAFC] hover:border-indigo-400 dark:hover:border-indigo-600 border-[#E5E7EB] dark:border-[#27272A]",
                )}
                title={t.quickAdd.scanReceiptBtn}
              >
                {isScanning ? (
                  <Loader2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 animate-spin shrink-0" />
                ) : (
                  <Camera className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                )}
                <span className="truncate">
                  {language === "en" ? "Scan" : "Pindai"}
                </span>
              </button>

              {/* Breakdown Items Button */}
              <button
                type="button"
                onClick={() => setShowItemsBreakdown(!showItemsBreakdown)}
                className={cn(
                  "py-2 px-1.5 rounded-xl border text-[11px] sm:text-xs font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer select-none",
                  showItemsBreakdown
                    ? "bg-[#0F172A] text-white border-[#0F172A] dark:bg-[#FAFAFA] dark:text-[#0F172A] shadow-xs"
                    : "bg-[#F8F9FA] dark:bg-[#1A1A20] text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#FAFAFA] border-[#E5E7EB] dark:border-[#27272A]",
                )}
              >
                <ListPlus className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">
                  {language === "en" ? "Items" : "Rincian"}
                </span>
                {items.length > 0 && (
                  <span className="px-1 py-0.2 rounded-full bg-white/20 text-[9px] font-bold">
                    {items.length}
                  </span>
                )}
              </button>

              {/* Free Text Memo Button */}
              <button
                type="button"
                onClick={() => setShowFreeMemo(!showFreeMemo)}
                className={cn(
                  "py-2 px-1.5 rounded-xl border text-[11px] sm:text-xs font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer select-none",
                  showFreeMemo
                    ? "bg-[#0F172A] text-white border-[#0F172A] dark:bg-[#FAFAFA] dark:text-[#0F172A] shadow-xs"
                    : "bg-[#F8F9FA] dark:bg-[#1A1A20] text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#FAFAFA] border-[#E5E7EB] dark:border-[#27272A]",
                )}
              >
                <AlignLeft className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">
                  {language === "en" ? "Memo" : "Memo"}
                </span>
              </button>

              {/* Tags (#tags) Button */}
              <button
                type="button"
                onClick={() => setShowTags(!showTags)}
                className={cn(
                  "py-2 px-1.5 rounded-xl border text-[11px] sm:text-xs font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer select-none",
                  showTags
                    ? "bg-[#0F172A] text-white border-[#0F172A] dark:bg-[#FAFAFA] dark:text-[#0F172A] shadow-xs"
                    : "bg-[#F8F9FA] dark:bg-[#1A1A20] text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#FAFAFA] border-[#E5E7EB] dark:border-[#27272A]",
                )}
              >
                <Hash className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Tags</span>
                {tags.length > 0 && (
                  <span className="px-1 py-0.2 rounded-full bg-white/20 text-[9px] font-bold">
                    {tags.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* 6.5 Expandable Tags (#tags) Drawer */}
          {showTags && (
            <div className="p-3 rounded-xl bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-2 animate-in fade-in duration-150">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
                {t.transactions.tagLabel}
              </span>
              <div className="flex flex-wrap items-center gap-1.5 min-h-[28px]">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] text-xs font-bold text-[#0F172A] dark:text-[#FAFAFA] shadow-2xs"
                  >
                    <span>#{tag}</span>
                    <button
                      type="button"
                      onClick={() => setTags(tags.filter((t) => t !== tag))}
                      className="text-[#94A3B8] hover:text-rose-500 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      const clean = tagInput
                        .replace(/^#/, "")
                        .toLowerCase()
                        .trim();
                      if (clean && !tags.includes(clean)) {
                        setTags([...tags, clean]);
                        setTagInput("");
                      }
                    }
                  }}
                  placeholder={
                    tags.length === 0
                      ? t.transactions.tagPlaceholder
                      : "+ tag..."
                  }
                  className="flex-1 min-w-[120px] px-2 py-1 bg-transparent text-xs text-[#0F172A] dark:text-[#FAFAFA] placeholder:text-[#94A3B8] focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* 7. Expandable Sub-items Breakdown Drawer */}
          {showItemsBreakdown && (
            <div className="p-3 rounded-xl bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8] truncate">
                  {t.quickAdd.itemizedBreakdownTitle}
                </span>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] text-[11px] font-bold text-[#0F172A] dark:text-[#FAFAFA] hover:bg-[#F1F3F5] dark:hover:bg-[#1A1A20] active:scale-95 transition-all cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t.quickAdd.addItem}</span>
                </button>
              </div>

              {items.length === 0 ? (
                <div className="text-center py-3 text-xs text-[#94A3B8]">
                  {t.quickAdd.emptyItems}
                </div>
              ) : (
                <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-0.5">
                  {items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <input
                        type="text"
                        placeholder={`Item ${idx + 1}`}
                        value={item.name}
                        onChange={(e) =>
                          handleUpdateItem(idx, "name", e.target.value)
                        }
                        className="flex-1 min-w-0 px-2 py-1.5 rounded-lg bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] text-xs text-[#0F172A] dark:text-[#FAFAFA] placeholder:text-[#94A3B8]"
                      />
                      <input
                        type="number"
                        placeholder="0"
                        value={item.price}
                        onChange={(e) =>
                          handleUpdateItem(idx, "price", e.target.value)
                        }
                        className="w-20 sm:w-24 px-2 py-1.5 rounded-lg bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] text-xs font-mono font-bold text-[#0F172A] dark:text-[#FAFAFA] placeholder:text-[#94A3B8]"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="p-1.5 text-[#94A3B8] hover:text-[#E11D48] active:scale-90 transition-all cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Smart Allocation Summary Bar */}
              {items.length > 0 && (
                <div className="pt-2 border-t border-[#E5E7EB] dark:border-[#27272A] flex flex-col gap-2">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-[#64748B] dark:text-[#94A3B8]">
                      {t.quickAdd.itemizedTotal}:{" "}
                      <strong className="text-[#0F172A] dark:text-[#FAFAFA]">
                        {formatCurrency(itemsTotal, currentCurrency)}
                      </strong>
                    </span>

                    {isItemsMatching ? (
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        <span>
                          {language === "en" ? "Matched 100%" : "Cocok 100%"}
                        </span>
                      </span>
                    ) : hasRemainingUnitemized ? (
                      <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400">
                        {t.quickAdd.unitemizedRemaining}: +
                        {formatCurrency(remainingAmount, currentCurrency)}
                      </span>
                    ) : isItemsExceeding ? (
                      <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        <span>
                          +
                          {formatCurrency(
                            itemsTotal - numericAmount,
                            currentCurrency,
                          )}{" "}
                          ({language === "en" ? "Exceeds" : "Melebihi"})
                        </span>
                      </span>
                    ) : null}
                  </div>

                  {/* Sync Button when total does not match */}
                  {itemsTotal > 0 && itemsTotal !== numericAmount && (
                    <button
                      type="button"
                      onClick={() => {
                        setAmountStr(String(Math.round(itemsTotal)));
                        setError(null);
                      }}
                      className="w-full py-1.5 px-2 rounded-lg bg-white dark:bg-[#121215] border border-dashed border-[#CBD5E1] dark:border-[#334155] hover:border-[#0F172A] dark:hover:border-[#FAFAFA] text-[11px] font-medium text-[#475569] dark:text-[#CBD5E1] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Check className="w-3 h-3 text-[#0D9488]" />
                      <span>
                        {t.quickAdd.syncTotalWithItems}:{" "}
                        <strong>
                          {formatCurrency(itemsTotal, currentCurrency)}
                        </strong>
                      </span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 8. Expandable Free Text Memo Drawer */}
          {showFreeMemo && (
            <div className="p-3 rounded-xl bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A]">
              <textarea
                rows={2}
                value={freeTextMemo}
                onChange={(e) => setFreeTextMemo(e.target.value)}
                placeholder={t.quickAdd.memoPlaceholder}
                className="w-full p-2 rounded-lg bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] text-xs text-[#0F172A] dark:text-[#F8FAFC] placeholder:text-[#94A3B8] focus:outline-none"
              />
            </div>
          )}

          {error && (
            <p className="text-xs font-semibold text-[#E11D48] text-center pt-1">
              {error}
            </p>
          )}

          {/* 9. Action Footer Bar: Save only — Cancel lives in the page
              header above, and Delete lives outside this form entirely. */}
          <div className="mt-auto flex items-center gap-2 pt-2 border-t border-[#E5E7EB] dark:border-[#27272A]">
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold bg-[#0F172A] dark:bg-[#FAFAFA] text-white dark:text-[#0F172A] hover:opacity-90 active:scale-95 transition-all shadow-sm cursor-pointer disabled:opacity-60"
            >
              <Check className="w-3.5 h-3.5 stroke-[3]" />
              <span>{isLoading ? t.common.loading : t.common.save}</span>
            </button>
          </div>
        </>
      )}
    </form>
  );
}
