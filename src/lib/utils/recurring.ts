import { RecurringFrequency } from '@/types/database'
import { addDays, addWeeks, addMonths, addYears, format, parseISO } from 'date-fns'

/**
 * Calculate the next due date given the current due date, frequency, and interval
 */
export function calculateNextDueDate(
  currentDueDateStr: string,
  frequency: RecurringFrequency,
  intervalCount: number = 1
): string {
  const current = parseISO(currentDueDateStr)
  let next: Date

  switch (frequency) {
    case 'daily':
      next = addDays(current, intervalCount)
      break
    case 'weekly':
      next = addWeeks(current, intervalCount)
      break
    case 'monthly':
      next = addMonths(current, intervalCount)
      break
    case 'yearly':
      next = addYears(current, intervalCount)
      break
    default:
      next = addMonths(current, 1)
  }

  return format(next, 'yyyy-MM-dd')
}
