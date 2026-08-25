'use client'

import React from 'react'
import { useTheme } from '@/components/layout/theme-provider'
import { useLanguage } from '@/lib/i18n/language-context'
import { Sun, Moon, Monitor } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const { language } = useLanguage()

  const items = [
    {
      id: 'light' as const,
      icon: Sun,
      label: language === 'en' ? 'Light' : 'Terang',
    },
    {
      id: 'dark' as const,
      icon: Moon,
      label: language === 'en' ? 'Dark' : 'Gelap',
    },
    {
      id: 'system' as const,
      icon: Monitor,
      label: language === 'en' ? 'System' : 'Sistem',
    },
  ]

  return (
    <div
      className={cn(
        'inline-flex items-center p-0.5 bg-[#F1F3F5] dark:bg-[#1A1A20] rounded-lg border border-[#E5E7EB] dark:border-[#27272A]',
        className
      )}
    >
      {items.map(({ id, icon: Icon, label }) => {
        const isActive = theme === id
        return (
          <div key={id} className="relative group">
            <button
              type="button"
              onClick={() => setTheme(id)}
              className={cn(
                'p-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center justify-center',
                isActive
                  ? 'bg-white dark:bg-[#27272A] text-[#0F172A] dark:text-[#FAFAFA] border border-[#E5E7EB] dark:border-transparent shadow-2xs'
                  : 'text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#FAFAFA]'
              )}
              aria-label={label}
              title={label}
            >
              <Icon className="w-3.5 h-3.5" />
            </button>

            {/* Hover Floating Tooltip (Positioned below to prevent clipping at top edges) */}
            <div className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-1.5 hidden group-hover:flex flex-col items-center z-50 animate-in fade-in-0 zoom-in-95 duration-150">
              <div className="w-1.5 h-1.5 rotate-45 bg-[#0F172A] dark:bg-[#FAFAFA] -mb-1" />
              <div className="px-2 py-0.5 rounded-md bg-[#0F172A] dark:bg-[#FAFAFA] text-white dark:text-[#0F172A] text-[10px] font-bold whitespace-nowrap shadow-md">
                {label}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
