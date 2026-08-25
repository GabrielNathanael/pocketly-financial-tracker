'use client'

import React, { useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface BottomSheetProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  className?: string
}

export function BottomSheet({
  isOpen,
  onClose,
  title,
  children,
  className,
}: BottomSheetProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center p-0 md:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#0F172A]/70 dark:bg-black/80 transition-opacity"
        onClick={onClose}
      />

      {/* Sheet Container */}
      <div
        className={cn(
          'relative w-full max-w-lg bg-white dark:bg-[#121215] border-t md:border border-[#E5E7EB] dark:border-[#27272A] rounded-t-2xl md:rounded-xl shadow-2xl z-10 max-h-[94vh] flex flex-col overflow-hidden',
          className
        )}
      >
        {/* Mobile handle indicator */}
        <div className="flex flex-col items-center pt-2.5 pb-1 md:hidden">
          <div className="w-10 h-1 bg-[#D1D5DB] dark:bg-[#334155] rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E5E7EB] dark:border-[#27272A]">
          <h3 className="font-bold text-sm sm:text-base text-[#0F172A] dark:text-[#F8FAFC]">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] rounded-md hover:bg-[#F1F3F5] dark:hover:bg-[#1A1A20] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="px-5 py-4 overflow-y-auto pb-8 md:pb-5">{children}</div>
      </div>
    </div>
  )
}
