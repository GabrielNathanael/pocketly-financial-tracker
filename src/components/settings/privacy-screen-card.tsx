'use client'

import React from 'react'
import { EyeOff } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/language-context'
import { cn } from '@/lib/utils/cn'
import {
  setPrivacyScreenEnabled,
  usePrivacyScreenEnabled,
} from '@/lib/storage/privacy-screen'

export function PrivacyScreenCard() {
  const { t } = useLanguage()
  const enabled = usePrivacyScreenEnabled()

  return (
    <div className="p-4 sm:p-5 rounded-xl bg-surface border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-lg bg-surface-subtle border border-border text-foreground flex items-center justify-center shrink-0">
          <EyeOff className="w-4 h-4" />
        </div>
        <div className="flex flex-col min-w-0">
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
            {t.settings.privacyScreenTitle}
          </h3>
          <p className="text-xs text-muted-foreground">
            {t.settings.privacyScreenDesc}
          </p>
        </div>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => setPrivacyScreenEnabled(!enabled)}
        className={cn(
          'shrink-0 inline-flex items-center gap-2.5 px-3 py-2 rounded-xl border text-xs font-bold transition-colors cursor-pointer self-start sm:self-auto',
          enabled
            ? 'bg-primary text-primary-foreground border-primary'
            : 'bg-surface-subtle text-foreground-secondary border-border hover:text-foreground',
        )}
      >
        <span
          className={cn(
            'relative w-8 h-4.5 rounded-full transition-colors',
            enabled ? 'bg-primary-foreground/40' : 'bg-border',
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 w-3.5 h-3.5 rounded-full bg-surface shadow-xs transition-all',
              enabled ? 'left-4' : 'left-0.5',
            )}
          />
        </span>
        {enabled ? t.settings.privacyScreenOn : t.settings.privacyScreenOff}
      </button>
    </div>
  )
}
