import { Language } from '@/lib/i18n/translations'

/**
 * Standard bilingual mapping strictly for system-reserved / protected categories.
 * User-created and regular expense/income categories are preserved as-is.
 */
export const SYSTEM_CATEGORY_TRANSLATIONS: Record<string, { id: string; en: string }> = {
  'Discrepancy': { id: 'Koreksi Saldo Kas', en: 'Discrepancy' },
  'Koreksi Saldo Kas': { id: 'Koreksi Saldo Kas', en: 'Discrepancy' },
  'Selisih Saldo': { id: 'Koreksi Saldo Kas', en: 'Discrepancy' },
  'Selisih Kas': { id: 'Koreksi Saldo Kas', en: 'Discrepancy' },

  'Loan & Debt': { id: 'Pinjaman & Utang', en: 'Loan & Debt' },
  'Pinjaman & Utang': { id: 'Pinjaman & Utang', en: 'Loan & Debt' },
  'Hutang & Piutang': { id: 'Pinjaman & Utang', en: 'Loan & Debt' },

  'Transfer Fee': { id: 'Biaya Admin & Transfer', en: 'Transfer Fee' },
  'Biaya Admin & Transfer': { id: 'Biaya Admin & Transfer', en: 'Transfer Fee' },
  'Biaya Transfer': { id: 'Biaya Admin & Transfer', en: 'Transfer Fee' },
  'Bank Fee': { id: 'Biaya Admin & Transfer', en: 'Transfer Fee' },

  'Savings': { id: 'Tabungan', en: 'Savings' },
  'Tabungan': { id: 'Tabungan', en: 'Savings' },
  'Alokasi Tabungan': { id: 'Tabungan', en: 'Savings' },
}

/**
 * Returns canonical English name for system-reserved categories, or original name for regular categories.
 */
export function getCanonicalCategoryName(name: string): string {
  if (!name) return ''
  const item = SYSTEM_CATEGORY_TRANSLATIONS[name.trim()]
  return item ? item.en : name.trim()
}

/**
 * Formats category name:
 * - If it is a system-reserved category (Discrepancy, Loan & Debt, Transfer Fee), returns its localized bilingual label.
 * - For all user/regular categories, returns the stored name as-is without forced translations.
 */
export function formatCategoryName(name: string, language?: Language): string {
  if (!name) return ''
  const item = SYSTEM_CATEGORY_TRANSLATIONS[name.trim()]
  if (item) {
    return language === 'id' ? item.id : item.en
  }
  return name.trim()
}
