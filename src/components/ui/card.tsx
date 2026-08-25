'use client'

import React from 'react'
import { cn } from '@/lib/utils/cn'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'flat' | 'contrast' | 'inset'
}

export function Card({ className, variant = 'default', children, ...props }: CardProps) {
  const variants = {
    default:
      'bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] shadow-none rounded-xl',
    flat:
      'bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] rounded-xl',
    contrast:
      'bg-[#0F172A] text-white dark:bg-[#1E293B] border border-[#1E293B] dark:border-[#334155] rounded-xl',
    inset:
      'bg-[#F1F3F5] dark:bg-[#18181D] border border-transparent rounded-lg',
  }

  return (
    <div
      className={cn('p-4 sm:p-5 transition-colors', variants[variant], className)}
      {...props}
    >
      {children}
    </div>
  )
}
