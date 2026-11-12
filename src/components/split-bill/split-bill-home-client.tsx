"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, ChevronRight, History, PenLine } from "lucide-react";
 
import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/lib/utils/currency";
import { useLanguage } from "@/lib/i18n/language-context";
 
import type { SplitBill } from "@/types/split-bill";

/** Tanggal singkat untuk "terakhir dibuka". */
function formatRecentDate(iso: string, language: "id" | "en"): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString(language === "id" ? "id-ID" : "en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

/**
 * Halaman awal Split Bill: langsung pilih cara mulai (Scan / Manual),
 * riwayat dipindah ke halaman terpisah (/split-bill/history).
 */
export function SplitBillHomeClient({ bills }: { bills: SplitBill[] }) {
  const { t, language } = useLanguage();
  const router = useRouter();
  const [isStartingManual, setIsStartingManual] = useState(false);
  const total = bills.length;

  const startManual = () => {
    if (isStartingManual) return;
    setIsStartingManual(true);
    router.push("/split-bill?mode=manual");
  };

  // "Terakhir dibuka" = yang paling baru diubah/dibuka
  const recent = [...bills]
    .sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime())
    .slice(0, 3);

  const cardBase =
    "group flex flex-col rounded-2xl border border-[#E5E7EB] dark:border-[#27272A] bg-white dark:bg-[#121215] p-5 transition-colors hover:border-[#94A3B8] hover:bg-[#F8F9FA] dark:hover:bg-[#1A1A20]";
  // Scan Struk = kartu utama (hitam), Manual Input = kartu sekunder (putih)
  const cardPrimary =
    "group flex flex-col rounded-2xl border border-[#0F172A] dark:border-[#FAFAFA] bg-[#0F172A] dark:bg-[#FAFAFA] p-5 transition-opacity hover:opacity-95";

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-5">
      {/* Header + riwayat */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0F172A] dark:text-[#FAFAFA]">
            {t.splitBill.title}
          </h1>
          <p className="text-sm text-[#64748B] dark:text-[#94A3B8] mt-1">
            {t.splitBill.subtitle}
          </p>
        </div>
        <Link
          href="/split-bill/history"
          title={t.splitBill.history}
          aria-label={t.splitBill.history}
          className="relative w-11 h-11 shrink-0 rounded-full border border-[#E5E7EB] dark:border-[#27272A] bg-white dark:bg-[#121215] flex items-center justify-center hover:bg-[#F8F9FA] dark:hover:bg-[#1A1A20] transition-colors"
        >
          <History className="w-5 h-5 text-[#0F172A] dark:text-[#FAFAFA]" />
          {total > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#0F172A] dark:bg-[#FAFAFA] text-white dark:text-[#0F172A] text-[10px] font-bold flex items-center justify-center">
              {total}
            </span>
          )}
        </Link>
      </div>

      {/* Pilihan cara mulai */}
      <div className="grid sm:grid-cols-2 gap-3">
        <Link href="/split-bill?mode=scan" className={cardPrimary}>
          <span className="w-11 h-11 rounded-xl bg-white/15 text-white dark:text-[#0F172A] flex items-center justify-center">
            <Camera className="w-5 h-5" />
          </span>
          <span className="block text-base font-bold mt-4 text-white dark:text-[#0F172A]">
            {t.splitBill.startScan}
          </span>
          <span className="block text-xs text-white/60 dark:text-[#0F172A]/70 mt-1 leading-relaxed">
            {t.splitBill.startScanDesc}
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-white/70 dark:text-[#0F172A]/70 mt-4 transition-opacity group-hover:opacity-100">
            {language === "id" ? "Mulai" : "Start"}
            <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </Link>

        <button type="button" onClick={startManual} disabled={isStartingManual} className={cn(cardBase, "text-left w-full", isStartingManual && "opacity-70 cursor-not-allowed")}>
          <span className="w-11 h-11 rounded-xl bg-[#F1F3F5] dark:bg-[#1A1A20] text-[#0F172A] dark:text-[#FAFAFA] flex items-center justify-center">
            <PenLine className="w-5 h-5" />
          </span>
          <span className="block text-base font-bold mt-4 text-[#0F172A] dark:text-[#FAFAFA]">
            {t.splitBill.startManual}
          </span>
          <span className="block text-xs text-[#64748B] dark:text-[#94A3B8] mt-1 leading-relaxed">
            {t.splitBill.startManualDesc}
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#94A3B8] mt-4 group-hover:text-[#0F172A] dark:group-hover:text-[#FAFAFA] transition-colors">
            {language === "id" ? "Mulai" : "Start"}
            <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </button>
      </div>

      {/* Terakhir dibuka */}
      {recent.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">
              {language === "id" ? "Terakhir dibuka" : "Recently opened"}
            </p>
            <Link
              href="/split-bill/history"
              className="text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#FAFAFA] transition-colors"
            >
              {language === "id" ? "Lihat semua" : "See all"}
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            {recent.map((b) => (
              <Link
                key={b.id}
                href={`/split-bill/${b.id}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-[#E5E7EB] dark:border-[#27272A] bg-white dark:bg-[#121215] px-3.5 py-2.5 hover:bg-[#F8F9FA] dark:hover:bg-[#1A1A20] transition-colors"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-[#0F172A] dark:text-[#FAFAFA] truncate">
                    {b.title || t.splitBill.title}
                  </span>
                  <span className="block text-[11px] text-[#94A3B8] mt-0.5 truncate">
                    {formatRecentDate(b.updated_at, language)} ·{" "}
                    {formatCurrency(Number(b.grand_total_amount) || 0, b.currency)}
                  </span>
                </span>
                <span className="flex items-center gap-1.5 shrink-0">
                  {b.split_mode === "equal" && (
                    <span className="text-[10px] font-bold rounded-full border border-[#E5E7EB] dark:border-[#27272A] px-2 py-0.5 text-[#64748B] dark:text-[#94A3B8]">
                      {t.splitBill.equalSplit}
                    </span>
                  )}
                  <span
                    className={cn(
                      "text-[10px] px-2 py-0.5 rounded-full font-semibold",
                      b.status === "balanced"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                        : "bg-[#F1F3F5] text-[#64748B] dark:bg-[#1A1A20] dark:text-[#94A3B8]",
                    )}
                  >
                    {b.status === "balanced" ? t.splitBill.balanced : t.splitBill.draft}
                  </span>
                  <ChevronRight className="w-4 h-4 text-[#CBD5E1]" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
