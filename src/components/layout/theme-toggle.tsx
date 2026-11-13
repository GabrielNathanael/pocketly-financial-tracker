'use client'

import React, { useSyncExternalStore } from 'react'
import { useTheme } from '@/components/layout/theme-provider'
import { useLanguage } from '@/lib/i18n/language-context'
import { Sun, Moon, Monitor } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

const subscribe = () => () => {}
const getSnapshot = () => true
const getServerSnapshot = () => false

export function ThemeToggle({
  className,
  showLabels = false,
}: {
  className?: string
  showLabels?: boolean
}) {
  const { theme, setTheme } = useTheme()
  const { t } = useLanguage()
  const mounted = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const items = [
    {
      id: 'light' as const,
      icon: Sun,
      label: t.common.themeLight,
    },
    {
      id: 'dark' as const,
      icon: Moon,
      label: t.common.themeDark,
    },
    {
      id: 'system' as const,
      icon: Monitor,
      label: t.common.themeSystem,
    },
  ]

  return (
    <div
      className={cn(
        'p-0.5 bg-muted rounded-lg border border-border',
        showLabels ? 'grid grid-cols-3 w-full sm:w-auto' : 'inline-flex items-center',
        className
      )}
    >
      {items.map(({ id, icon: Icon, label }) => {
        const isActive = mounted && theme === id
        return (
          <div key={id} className="relative group">
            <button
              type="button"
              onClick={() => setTheme(id)}
              className={cn(
                'rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 w-full',
                showLabels ? 'px-3 py-1.5' : 'p-1.5',
                isActive
                  ? 'bg-surface text-foreground border border-border shadow-2xs font-bold'
                  : 'text-foreground-secondary hover:text-foreground'
              )}
              aria-label={label}
              title={label}
            >
              <Icon className="w-3.5 h-3.5" />
              {showLabels && <span className="text-xs">{label}</span>}
            </button>

            {/* Hover Floating Tooltip (Positioned below to prevent clipping at top edges) */}
            <div className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-1.5 hidden group-hover:flex flex-col items-center z-50 animate-in fade-in-0 zoom-in-95 duration-150">
              <div className="w-1.5 h-1.5 rotate-45 bg-primary -mb-1" />
              <div className="px-2 py-0.5 rounded-md bg-primary text-primary-foreground text-[10px] font-bold whitespace-nowrap shadow-md">
                {label}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
