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
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center rounded-xl border border-dashed border-border-strong/30 dark:border-border-inverse bg-canvas/80 dark:bg-surface/50">
      <div className="w-11 h-11 rounded-lg bg-accent dark:bg-surface-muted text-foreground-secondary flex items-center justify-center mb-3">
        <DynamicIcon name={icon} className="w-5 h-5" />
      </div>
      <h4 className="text-sm font-bold text-foreground tracking-tight">
        {title}
      </h4>
      <p className="text-xs text-muted-foreground max-w-xs mt-1 mb-4 leading-relaxed">
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
