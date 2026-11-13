'use client'

import React from 'react'
import { cn } from '@/lib/utils/cn'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'outline' | 'flat'
}

export function Badge({ className, variant = 'default', children, ...props }: BadgeProps) {
  const variants = {
    default:
      'bg-secondary text-secondary-foreground border border-border',
    success:
      'bg-success-muted text-success border border-success/30',
    warning:
      'bg-warning-muted text-warning border border-warning/30',
    danger:
      'bg-destructive-muted text-destructive border border-destructive/30',
    info:
      'bg-info-muted text-info border border-info/30',
    outline:
      'border border-border text-foreground-secondary bg-transparent',
    flat:
      'bg-surface-inverse text-foreground-inverse',
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
