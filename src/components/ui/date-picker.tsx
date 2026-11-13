'use client'

import * as React from 'react'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react'
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isToday as isDateToday,
  addMonths,
  subMonths,
} from 'date-fns'
import { id as idLocale, enUS as enLocale } from 'date-fns/locale'
import { useLanguage } from '@/lib/i18n/language-context'
import { cn } from '@/lib/utils/cn'

interface DatePickerProps {
  value: string // 'YYYY-MM-DD'
  onChange: (value: string) => void
  className?: string
  placeholder?: string
  clearable?: boolean
}

export function DatePicker({
  value,
  onChange,
  className,
  placeholder,
  clearable = true,
}: DatePickerProps) {
  const { language, t } = useLanguage()
  const locale = language === 'en' ? enLocale : idLocale
  const [open, setOpen] = React.useState(false)

  const defaultPlaceholder = placeholder || t.common.selectDatePlaceholder

  const selectedDate = React.useMemo(() => {
    try {
      return value ? parseISO(value) : new Date()
    } catch {
      return new Date()
    }
  }, [value])

  const [navMonth, setNavMonth] = React.useState<Date | null>(null)
  const currentMonth = navMonth || selectedDate

  const daysInMonth = React.useMemo(() => {
    const start = startOfMonth(currentMonth)
    const end = endOfMonth(currentMonth)
    return eachDayOfInterval({ start, end })
  }, [currentMonth])

  // Leading empty cells for day of week alignment
  const startDayOfWeek = startOfMonth(currentMonth).getDay() // 0 is Sunday

  const handleSelect = (day: Date) => {
    const formatted = format(day, 'yyyy-MM-dd')
    onChange(formatted)
    setOpen(false)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange('')
    setOpen(false)
  }

  const setQuickDate = (type: 'today' | 'yesterday') => {
    const d = new Date()
    if (type === 'yesterday') {
      d.setDate(d.getDate() - 1)
    }
    const formatted = format(d, 'yyyy-MM-dd')
    onChange(formatted)
    setNavMonth(d)
    setOpen(false)
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
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
            <span className="truncate">
              {value
                ? format(selectedDate, language === 'en' ? 'MMMM d, yyyy' : 'd MMMM yyyy', { locale })
                : defaultPlaceholder}
            </span>
          </div>

          {clearable && value && (
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
          className="z-50 w-64 p-3 rounded-xl bg-surface border border-border text-foreground shadow-xl animate-in fade-in-0 zoom-in-95"
        >
          {/* Quick Buttons */}
          <div className="grid grid-cols-2 gap-1.5 mb-2.5 pb-2 border-b border-border">
            <button
              type="button"
              onClick={() => setQuickDate('today')}
              className="px-2 py-1 rounded-md text-[11px] font-semibold bg-secondary hover:bg-accent text-foreground transition-colors cursor-pointer text-center"
            >
              {t.common.today}
            </button>
            <button
              type="button"
              onClick={() => setQuickDate('yesterday')}
              className="px-2 py-1 rounded-md text-[11px] font-semibold bg-secondary hover:bg-accent text-foreground transition-colors cursor-pointer text-center"
            >
              {t.common.yesterday}
            </button>
          </div>

          {/* Month Header Navigation */}
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => setNavMonth(subMonths(currentMonth, 1))}
              className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="text-xs font-bold font-mono">
              {format(currentMonth, 'MMMM yyyy', { locale })}
            </span>

            <button
              type="button"
              onClick={() => setNavMonth(addMonths(currentMonth, 1))}
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
              const isSelected = value && isSameDay(day, selectedDate)
              const isToday = isDateToday(day)

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => handleSelect(day)}
                  className={cn(
                    'h-7 w-7 rounded-md text-xs font-mono flex items-center justify-center transition-colors cursor-pointer',
                    isSelected
                      ? 'bg-primary text-primary-foreground font-bold shadow-2xs'
                      : isToday
                      ? 'border border-border-strong font-bold text-foreground'
                      : 'hover:bg-secondary text-foreground'
                  )}
                >
                  {format(day, 'd')}
                </button>
              )
            })}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
