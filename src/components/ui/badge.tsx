'use client'

import React from 'react'
import { cn } from '@/lib/utils/cn'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'outline' | 'flat'
}

export function Badge({ className, variant = 'default', children, ...props }: BadgeProps) {
  const variants = {
    default:
      'bg-[#F1F3F5] dark:bg-[#1A1A20] text-[#0F172A] dark:text-[#F8FAFC] border border-[#E5E7EB] dark:border-[#27272A]',
    success:
      'bg-[#ECFDF5] dark:bg-[#064E3B]/30 text-[#047857] dark:text-[#34D399] border border-[#A7F3D0] dark:border-[#065F46]',
    warning:
      'bg-[#FFFBEB] dark:bg-[#78350F]/30 text-[#B45309] dark:text-[#FBBF24] border border-[#FDE68A] dark:border-[#92400E]',
    danger:
      'bg-[#FFF1F2] dark:bg-[#881337]/30 text-[#BE123C] dark:text-[#FB7185] border border-[#FECDD3] dark:border-[#9F1239]',
    info:
      'bg-[#F0F9FF] dark:bg-[#0C4A6E]/30 text-[#0369A1] dark:text-[#38BDF8] border border-[#BAE6FD] dark:border-[#075985]',
    outline:
      'border border-[#E5E7EB] dark:border-[#27272A] text-[#475569] dark:text-[#94A3B8] bg-transparent',
    flat:
      'bg-[#0F172A] text-white dark:bg-white dark:text-[#0F172A]',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}
