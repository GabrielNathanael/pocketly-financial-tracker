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
        'bg-primary hover:bg-primary-hover text-primary-foreground border border-transparent shadow-none',
      secondary:
        'bg-secondary hover:bg-secondary-hover text-secondary-foreground border border-border',
      outline:
        'border border-border hover:bg-canvas bg-surface text-foreground',
      danger:
        'bg-destructive hover:bg-destructive-hover text-destructive-foreground border border-transparent',
      ghost:
        'text-foreground-secondary hover:text-foreground hover:bg-secondary',
      flat:
        'bg-primary/5 hover:bg-primary/10 text-foreground dark:bg-primary/10 dark:hover:bg-primary/15',
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
