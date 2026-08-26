import { Language } from '@/lib/i18n/translations'

/**
 * Standard bilingual mapping for default categories.
 * Maps both Indonesian and English names to the active interface language.
 */
export const CATEGORY_TRANSLATIONS: Record<string, { id: string; en: string }> = {
  // Expense Categories
  'Food & Drinks': { id: 'Makanan & Minuman', en: 'Food & Drinks' },
  'Makanan & Minuman': { id: 'Makanan & Minuman', en: 'Food & Drinks' },
  'Transportation': { id: 'Transportasi', en: 'Transportation' },
  'Transportasi': { id: 'Transportasi', en: 'Transportation' },
  'Transportasi & Bensin': { id: 'Transportasi', en: 'Transportation' },
  'Shopping': { id: 'Belanja & Kebutuhan', en: 'Shopping' },
  'Belanja': { id: 'Belanja & Kebutuhan', en: 'Shopping' },
  'Belanja & Kebutuhan': { id: 'Belanja & Kebutuhan', en: 'Shopping' },
  'Bills & Utilities': { id: 'Tagihan & Utilitas', en: 'Bills & Utilities' },
  'Tagihan & Utilitas': { id: 'Tagihan & Utilitas', en: 'Bills & Utilities' },
  'Housing': { id: 'Tempat Tinggal', en: 'Housing' },
  'Tempat Tinggal': { id: 'Tempat Tinggal', en: 'Housing' },
  'Entertainment': { id: 'Hiburan & Hobi', en: 'Entertainment' },
  'Hiburan': { id: 'Hiburan & Hobi', en: 'Entertainment' },
  'Hiburan & Hobi': { id: 'Hiburan & Hobi', en: 'Entertainment' },
  'Health & Medical': { id: 'Kesehatan & Medis', en: 'Health & Medical' },
  'Kesehatan': { id: 'Kesehatan & Medis', en: 'Health & Medical' },
  'Kesehatan & Medis': { id: 'Kesehatan & Medis', en: 'Health & Medical' },
  'Education': { id: 'Pendidikan', en: 'Education' },
  'Pendidikan': { id: 'Pendidikan', en: 'Education' },
  'Personal Care': { id: 'Perawatan Pribadi', en: 'Personal Care' },
  'Perawatan Pribadi': { id: 'Perawatan Pribadi', en: 'Personal Care' },
  'Family & Kids': { id: 'Keluarga & Anak', en: 'Family & Kids' },
  'Keluarga & Anak': { id: 'Keluarga & Anak', en: 'Family & Kids' },
  'Other Expense': { id: 'Pengeluaran Lainnya', en: 'Other Expense' },
  'Pengeluaran Lain': { id: 'Pengeluaran Lainnya', en: 'Other Expense' },
  'Pengeluaran Lainnya': { id: 'Pengeluaran Lainnya', en: 'Other Expense' },

  // Income Categories
  'Salary': { id: 'Gaji Pokok', en: 'Salary' },
  'Gaji': { id: 'Gaji Pokok', en: 'Salary' },
  'Gaji Pokok': { id: 'Gaji Pokok', en: 'Salary' },
  'Freelance & Side Gig': { id: 'Freelance & Proyek', en: 'Freelance & Side Gig' },
  'Freelance': { id: 'Freelance & Proyek', en: 'Freelance & Side Gig' },
  'Freelance & Proyek': { id: 'Freelance & Proyek', en: 'Freelance & Side Gig' },
  'Business & Sales': { id: 'Bisnis & Penjualan', en: 'Business & Sales' },
  'Bisnis & Penjualan': { id: 'Bisnis & Penjualan', en: 'Business & Sales' },
  'Investments & Dividends': { id: 'Investasi & Dividen', en: 'Investments & Dividends' },
  'Investasi & Dividen': { id: 'Investasi & Dividen', en: 'Investments & Dividends' },
  'Investasi': { id: 'Investasi & Dividen', en: 'Investments & Dividends' },
  'Gifts & Grants': { id: 'Hadiah & Hibah', en: 'Gifts & Grants' },
  'Hadiah & Hibah': { id: 'Hadiah & Hibah', en: 'Gifts & Grants' },
  'Other Income': { id: 'Pemasukan Lainnya', en: 'Other Income' },
  'Pemasukan Lain': { id: 'Pemasukan Lainnya', en: 'Other Income' },
  'Pemasukan Lainnya': { id: 'Pemasukan Lainnya', en: 'Other Income' },
}

/**
 * Returns canonical English name for deduplication
 */
export function getCanonicalCategoryName(name: string): string {
  if (!name) return ''
  const item = CATEGORY_TRANSLATIONS[name.trim()]
  return item ? item.en : name.trim()
}

/**
 * Formats category name - returns standard English name for default categories, or custom name.
 */
export function formatCategoryName(name: string, _language?: Language): string {
  if (!name) return ''
  const item = CATEGORY_TRANSLATIONS[name.trim()]
  if (item) {
    return item.en
  }
  return name.trim()
}
