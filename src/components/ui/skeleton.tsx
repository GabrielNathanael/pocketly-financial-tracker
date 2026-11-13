'use client'

import React from 'react'
import { cn } from '@/lib/utils/cn'

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded bg-border dark:bg-surface-muted', className)}
      {...props}
    />
  )
}
