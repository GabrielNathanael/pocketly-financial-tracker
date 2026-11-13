'use client'

import React from 'react'
import { usePrivacyMode, togglePrivacyMode } from '@/lib/storage/privacy-mode'
import { useLanguage } from '@/lib/i18n/language-context'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface PrivacyToggleProps {
  className?: string
  variant?: 'header' | 'hero'
}

export function PrivacyToggle({ className, variant = 'header' }: PrivacyToggleProps) {
  const isPrivate = usePrivacyMode()
  const { t } = useLanguage()

  const label = isPrivate
    ? t.common.showBalance
    : t.common.hideBalance

  if (variant === 'hero') {
    return (
      <button
        type="button"
        onClick={() => togglePrivacyMode()}
        className={cn(
          'p-1.5 rounded-lg transition-all duration-200 cursor-pointer flex items-center justify-center',
          isPrivate
            ? 'bg-warning-muted text-warning hover:opacity-90 border border-warning/30'
            : 'bg-white/10 text-white/80 hover:text-white hover:bg-white/20 border border-white/10',
          className
        )}
        title={label}
        aria-label={label}
      >
        {isPrivate ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    )
  }

  return (
    <div className="relative group">
      <button
        type="button"
        onClick={() => togglePrivacyMode()}
        className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center border transition-all duration-200 cursor-pointer relative',
          isPrivate
            ? 'bg-warning-muted border-warning/30 text-warning'
            : 'bg-surface border-border text-foreground-secondary hover:text-foreground',
          className
        )}
        title={label}
        aria-label={label}
      >
        {isPrivate ? (
          <EyeOff className="w-3.5 h-3.5" />
        ) : (
          <Eye className="w-3.5 h-3.5" />
        )}
      </button>

      {/* Downward tooltip */}
      <div className="absolute top-full mt-1.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md bg-primary text-primary-foreground text-[10px] font-medium whitespace-nowrap shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
        {label}
      </div>
    </div>
  )
}
