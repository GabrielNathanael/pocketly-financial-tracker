'use client'

import React from 'react'
import { cn } from '@/lib/utils/cn'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'flat' | 'contrast' | 'inset'
}

export function Card({ className, variant = 'default', children, ...props }: CardProps) {
  const variants = {
    default:
      'bg-surface border border-border shadow-none rounded-xl',
    flat:
      'bg-canvas border border-border rounded-xl',
    contrast:
      'bg-surface-inverse text-foreground-inverse border border-border-inverse rounded-xl',
    inset:
      'bg-surface-subtle border border-transparent rounded-lg',
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
