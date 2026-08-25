'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { DynamicIcon } from '@/components/ui/dynamic-icon'

interface EmptyStateProps {
  icon?: string
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({
  icon = 'Inbox',
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center rounded-xl border border-dashed border-[#CBD5E1] dark:border-[#334155] bg-[#F8F9FA]/80 dark:bg-[#121215]/50">
      <div className="w-11 h-11 rounded-lg bg-[#E2E8F0] dark:bg-[#1E293B] text-[#475569] dark:text-[#94A3B8] flex items-center justify-center mb-3">
        <DynamicIcon name={icon} className="w-5 h-5" />
      </div>
      <h4 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC] tracking-tight">
        {title}
      </h4>
      <p className="text-xs text-[#64748B] dark:text-[#94A3B8] max-w-xs mt-1 mb-4 leading-relaxed">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
