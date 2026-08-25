'use client'

import React from 'react'
import { Category, TransactionType } from '@/types/database'
import { DynamicIcon } from '@/components/ui/dynamic-icon'
import { useLanguage } from '@/lib/i18n/language-context'
import { cn } from '@/lib/utils/cn'

interface CategoryPickerProps {
  categories: Category[]
  selectedId?: string
  onSelect: (categoryId: string) => void
  typeFilter?: TransactionType
}

export function CategoryPicker({
  categories,
  selectedId,
  onSelect,
  typeFilter,
}: CategoryPickerProps) {
  const { t } = useLanguage()
  const filtered = typeFilter ? categories.filter((c) => c.type === typeFilter) : categories

  if (filtered.length === 0) {
    return (
      <div className="py-4 text-center text-xs text-[#94A3B8]">
        {t.quickAdd.noCategoriesForType}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5 max-h-36 sm:max-h-44 overflow-y-auto p-0.5 no-scrollbar">
      {filtered.map((cat) => {
        const isSelected = selectedId === cat.id
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onSelect(cat.id)}
            className={cn(
              'flex flex-col items-center justify-center p-1 sm:p-1.5 rounded-lg border transition-all select-none group cursor-pointer text-center',
              isSelected
                ? 'border-[#0F172A] bg-[#0F172A] text-white dark:border-[#FAFAFA] dark:bg-[#FAFAFA] dark:text-[#0F172A] font-bold shadow-2xs'
                : 'border-[#E5E7EB] dark:border-[#27272A] bg-[#F8F9FA] dark:bg-[#1A1A20] hover:bg-[#F1F3F5] dark:hover:bg-[#26262E] text-[#0F172A] dark:text-[#F8FAFC]'
            )}
          >
            <div
              className={cn(
                'w-6 h-6 sm:w-7 sm:h-7 rounded-md flex items-center justify-center mb-1 transition-transform',
                isSelected
                  ? 'bg-white/20 dark:bg-[#0F172A]/15 text-white dark:text-[#0F172A]'
                  : 'bg-white dark:bg-[#121215] text-[#0F172A] dark:text-[#F8FAFC] border border-[#E5E7EB] dark:border-[#27272A]'
              )}
            >
              <DynamicIcon name={cat.icon} className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </div>
            <span className="text-[9px] sm:text-[10px] leading-tight truncate w-full px-0.5">
              {cat.name}
            </span>
          </button>
        )
      })}
    </div>
  )
}
