'use client'

import React, { ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils/cn'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'flat'
  size?: 'sm' | 'md' | 'lg' | 'icon'
  isLoading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, children, disabled, ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center font-semibold transition-all duration-100 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none rounded-lg cursor-pointer select-none text-center'

    const variants = {
      primary:
        'bg-[#0F172A] hover:bg-[#1E293B] text-white dark:bg-[#F8FAFC] dark:hover:bg-[#E2E8F0] dark:text-[#0F172A] border border-transparent shadow-none',
      secondary:
        'bg-[#F1F3F5] hover:bg-[#E9ECEF] text-[#0F172A] dark:bg-[#1A1A20] dark:hover:bg-[#26262E] dark:text-[#F8FAFC] border border-[#E5E7EB] dark:border-[#27272A]',
      outline:
        'border border-[#E5E7EB] dark:border-[#27272A] hover:bg-[#F8F9FA] dark:hover:bg-[#1A1A20] text-[#0F172A] dark:text-[#F8FAFC] bg-white dark:bg-[#121215]',
      danger:
        'bg-[#E11D48] hover:bg-[#BE123C] text-white border border-transparent',
      ghost:
        'text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] hover:bg-[#F1F3F5] dark:hover:bg-[#1A1A20]',
      flat:
        'bg-[#0F172A]/5 hover:bg-[#0F172A]/10 text-[#0F172A] dark:bg-white/10 dark:hover:bg-white/15 dark:text-[#F8FAFC]',
    }

    const sizes = {
      sm: 'text-xs px-3 py-1.5 gap-1.5 h-8',
      md: 'text-xs sm:text-sm px-4 py-2.5 gap-2 h-10',
      lg: 'text-sm sm:text-base px-5 py-3 gap-2 h-12',
      icon: 'h-9 w-9 p-0',
    }

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading ? (
          <span className="inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
        ) : null}
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'
