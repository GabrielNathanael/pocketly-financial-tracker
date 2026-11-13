'use client'

import * as React from 'react'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react'
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subMonths,
  eachDayOfInterval,
  isSameDay,
  isWithinInterval,
  isBefore,
  addMonths,
} from 'date-fns'
import { id as idLocale, enUS as enLocale } from 'date-fns/locale'
import { useLanguage } from '@/lib/i18n/language-context'
import { cn } from '@/lib/utils/cn'

interface DateRangePickerProps {
  startDate: string // 'YYYY-MM-DD'
  endDate: string // 'YYYY-MM-DD'
  onChange: (start: string, end: string) => void
  className?: string
  placeholder?: string
}

export function DateRangePicker({
  startDate,
  endDate,
  onChange,
  className,
  placeholder,
}: DateRangePickerProps) {
  const { language, t } = useLanguage()
  const locale = language === 'en' ? enLocale : idLocale
  const [open, setOpen] = React.useState(false)

  const defaultPlaceholder = placeholder || t.transactions.dateRange || (language === 'en' ? 'Date Range' : 'Rentang Tanggal')

  const parsedStart = React.useMemo(() => {
    try {
      return startDate ? parseISO(startDate) : null
    } catch {
      return null
    }
  }, [startDate])

  const parsedEnd = React.useMemo(() => {
    try {
      return endDate ? parseISO(endDate) : null
    } catch {
      return null
    }
  }, [endDate])

  const [navMonth, setNavMonth] = React.useState<Date>(parsedStart || new Date())
  const [hoverDay, setHoverDay] = React.useState<Date | null>(null)
  const [selectingStart, setSelectingStart] = React.useState<Date | null>(null)

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (nextOpen) {
      setSelectingStart(null)
      setHoverDay(null)
      if (parsedStart) {
        setNavMonth(parsedStart)
      }
    }
  }

  const daysInMonth = React.useMemo(() => {
    const start = startOfMonth(navMonth)
    const end = endOfMonth(navMonth)
    return eachDayOfInterval({ start, end })
  }, [navMonth])

  const startDayOfWeek = startOfMonth(navMonth).getDay()

  const handleDayClick = (day: Date) => {
    if (!selectingStart) {
      // First click: start date chosen
      setSelectingStart(day)
    } else {
      // Second click: end date chosen
      let start = selectingStart
      let end = day

      if (isBefore(end, start)) {
        const tmp = start
        start = end
        end = tmp
      }

      onChange(format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd'))
      setSelectingStart(null)
      setHoverDay(null)
      setOpen(false)
    }
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange('', '')
    setSelectingStart(null)
    setHoverDay(null)
    setOpen(false)
  }

  const applyPreset = (preset: 'today' | 'this_month' | 'last_month' | 'this_year') => {
    const now = new Date()
    let start = now
    let end = now

    if (preset === 'today') {
      start = now
      end = now
    } else if (preset === 'this_month') {
      start = startOfMonth(now)
      end = endOfMonth(now)
    } else if (preset === 'last_month') {
      const last = subMonths(now, 1)
      start = startOfMonth(last)
      end = endOfMonth(last)
    } else if (preset === 'this_year') {
      start = startOfYear(now)
      end = endOfYear(now)
    }

    onChange(format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd'))
    setNavMonth(start)
    setOpen(false)
  }

  const formattedLabel = React.useMemo(() => {
    if (parsedStart && parsedEnd) {
      if (isSameDay(parsedStart, parsedEnd)) {
        return format(parsedStart, language === 'en' ? 'MMM d, yyyy' : 'd MMM yyyy', { locale })
      }
      return `${format(parsedStart, language === 'en' ? 'MMM d' : 'd MMM', { locale })} – ${format(
        parsedEnd,
        language === 'en' ? 'MMM d, yyyy' : 'd MMM yyyy',
        { locale }
      )}`
    }
    if (parsedStart) {
      return `${language === 'en' ? 'From' : 'Mulai'} ${format(parsedStart, 'd MMM yyyy', { locale })}`
    }
    if (parsedEnd) {
      return `${language === 'en' ? 'Until' : 'Sampai'} ${format(parsedEnd, 'd MMM yyyy', { locale })}`
    }
    return defaultPlaceholder
  }, [parsedStart, parsedEnd, language, locale, defaultPlaceholder])

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          className={cn(
            'flex items-center justify-between gap-2 px-3 py-1.5 sm:py-2 rounded-lg text-xs font-semibold bg-surface border border-border text-foreground hover:bg-canvas dark:hover:bg-surface-subtle focus:outline-none focus:border-border-strong transition-colors cursor-pointer w-full text-left',
            className
          )}
        >
          <div className="flex items-center gap-2 truncate">
            <CalendarIcon className="w-3.5 h-3.5 text-foreground-muted shrink-0" />
            <span className={cn('truncate', (startDate || endDate) && 'font-mono')}>
              {formattedLabel}
            </span>
          </div>

          {(startDate || endDate) && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              className="p-0.5 rounded hover:bg-accent text-foreground-muted hover:text-destructive transition-colors cursor-pointer shrink-0"
              title="Reset"
            >
              <X className="w-3 h-3" />
            </span>
          )}
        </button>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          className="z-50 w-72 p-3 rounded-xl bg-surface border border-border text-foreground shadow-xl animate-in fade-in-0 zoom-in-95"
        >
          {/* Quick Preset Chips */}
          <div className="grid grid-cols-2 gap-1.5 mb-2.5 pb-2 border-b border-border">
            <button
              type="button"
              onClick={() => applyPreset('today')}
              className="px-2 py-1 rounded-md text-[11px] font-semibold bg-secondary hover:bg-accent text-foreground transition-colors cursor-pointer text-center"
            >
              {t.common.today}
            </button>
            <button
              type="button"
              onClick={() => applyPreset('this_month')}
              className="px-2 py-1 rounded-md text-[11px] font-semibold bg-secondary hover:bg-accent text-foreground transition-colors cursor-pointer text-center"
            >
              {t.dashboard.periodThisMonth}
            </button>
            <button
              type="button"
              onClick={() => applyPreset('last_month')}
              className="px-2 py-1 rounded-md text-[11px] font-semibold bg-secondary hover:bg-accent text-foreground transition-colors cursor-pointer text-center"
            >
              {t.dashboard.periodLastMonth}
            </button>
            <button
              type="button"
              onClick={() => applyPreset('this_year')}
              className="px-2 py-1 rounded-md text-[11px] font-semibold bg-secondary hover:bg-accent text-foreground transition-colors cursor-pointer text-center"
            >
              {t.dashboard.periodThisYear}
            </button>
          </div>

          {/* Month Header Navigation */}
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => setNavMonth(subMonths(navMonth, 1))}
              className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="text-xs font-bold font-mono">
              {format(navMonth, 'MMMM yyyy', { locale })}
            </span>

            <button
              type="button"
              onClick={() => setNavMonth(addMonths(navMonth, 1))}
              className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Day of Week Headers */}
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-foreground-muted mb-1">
            {(language === 'en'
              ? ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
              : ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
            ).map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>

          {/* Calendar Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: startDayOfWeek }).map((_, idx) => (
              <div key={`empty-${idx}`} />
            ))}

            {daysInMonth.map((day) => {
              const activeStart = selectingStart || parsedStart
              const activeEnd = selectingStart ? (hoverDay || selectingStart) : parsedEnd

              let effectiveStart = activeStart
              let effectiveEnd = activeEnd

              if (effectiveStart && effectiveEnd && isBefore(effectiveEnd, effectiveStart)) {
                const tmp = effectiveStart
                effectiveStart = effectiveEnd
                effectiveEnd = tmp
              }

              const isStart = effectiveStart && isSameDay(day, effectiveStart)
              const isEnd = effectiveEnd && isSameDay(day, effectiveEnd)
              const isInRange =
                effectiveStart &&
                effectiveEnd &&
                !isSameDay(effectiveStart, effectiveEnd) &&
                isWithinInterval(day, { start: effectiveStart, end: effectiveEnd })

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => handleDayClick(day)}
                  onMouseEnter={() => {
                    if (selectingStart) setHoverDay(day)
                  }}
                  className={cn(
                    'h-7.5 w-full rounded-md text-xs font-mono flex items-center justify-center transition-colors cursor-pointer',
                    (isStart || isEnd)
                      ? 'bg-primary text-primary-foreground font-bold shadow-2xs'
                      : isInRange
                      ? 'bg-secondary dark:bg-accent text-foreground'
                      : 'hover:bg-canvas dark:hover:bg-surface-subtle text-foreground'
                  )}
                >
                  {format(day, 'd')}
                </button>
              )
            })}
          </div>

          {selectingStart && (
            <div className="mt-2 pt-2 border-t border-border text-center text-[10px] text-muted-foreground dark:text-foreground-muted">
              {language === 'en' ? 'Select end date...' : 'Pilih tanggal selesai...'}
            </div>
          )}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
