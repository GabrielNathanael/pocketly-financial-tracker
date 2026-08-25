import { CurrencyCode, SUPPORTED_CURRENCIES, DEFAULT_CURRENCY } from '@/lib/constants/currencies'

export type { CurrencyCode }

export interface ForexRatesMap {
  [currencyCode: string]: number
}

export const DEFAULT_FALLBACK_RATES: ForexRatesMap = {
  USD: 1,
  IDR: 16200,
  SGD: 1.35,
}

export function formatCurrency(
  amount: number | null | undefined,
  currency: CurrencyCode | string = DEFAULT_CURRENCY,
  options?: { showSign?: boolean; compact?: boolean; decimals?: number }
): string {
  const value = Number(amount) || 0
  const isNegative = value < 0
  const absValue = Math.abs(value)
  const code = (currency || DEFAULT_CURRENCY).toUpperCase() as CurrencyCode
  const config = SUPPORTED_CURRENCIES[code]

  let formatted = ''

  if (code === 'USD') {
    if (options?.compact && absValue >= 1000000) {
      formatted = `$${(absValue / 1000000).toFixed(1)}M`
    } else if (options?.compact && absValue >= 1000) {
      formatted = `$${(absValue / 1000).toFixed(1)}k`
    } else {
      const decimals = options?.decimals !== undefined ? options.decimals : (config?.decimals ?? 2)
      formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(absValue)
    }
  } else if (code === 'SGD') {
    if (options?.compact && absValue >= 1000000) {
      formatted = `S$${(absValue / 1000000).toFixed(1)}M`
    } else if (options?.compact && absValue >= 1000) {
      formatted = `S$${(absValue / 1000).toFixed(1)}k`
    } else {
      const decimals = options?.decimals !== undefined ? options.decimals : (config?.decimals ?? 2)
      formatted = new Intl.NumberFormat('en-SG', {
        style: 'currency',
        currency: 'SGD',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(absValue)
    }
  } else {
    // Default IDR or fallback
    if (options?.compact && absValue >= 1000000000) {
      formatted = `Rp ${(absValue / 1000000000).toFixed(2)} M`
    } else if (options?.compact && absValue >= 1000000) {
      formatted = `Rp ${(absValue / 1000000).toFixed(1)} jt`
    } else {
      const decimals =
        options?.decimals !== undefined ? options.decimals : absValue % 1 !== 0 ? 2 : (config?.decimals ?? 0)
      const parts = new Intl.NumberFormat('id-ID', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(absValue)
      formatted = `Rp ${parts}`
    }
  }

  if (isNegative) {
    return `-${formatted}`
  }
  if (options?.showSign && value > 0) {
    return `+${formatted}`
  }

  return formatted
}

/**
 * Universal cross-currency converter using USD base matrix rates
 */
export function convertAmount(
  amount: number,
  fromCurrency: CurrencyCode | string,
  toCurrency: CurrencyCode | string,
  rates: ForexRatesMap | number = DEFAULT_FALLBACK_RATES
): number {
  if (!amount || fromCurrency === toCurrency) {
    return Number(amount) || 0
  }

  const from = (fromCurrency || 'IDR').toUpperCase()
  const to = (toCurrency || 'IDR').toUpperCase()

  // Backward compatibility if single number rate (USD->IDR) was passed
  if (typeof rates === 'number') {
    const usdToIdr = rates || 16200
    if (from === 'USD' && to === 'IDR') return amount * usdToIdr
    if (from === 'IDR' && to === 'USD') return amount / usdToIdr
    return amount
  }

  const rateMatrix = { ...DEFAULT_FALLBACK_RATES, ...rates }
  const fromRate = rateMatrix[from] || 1
  const toRate = rateMatrix[to] || 1

  // (amount / fromRate) converts to USD, then * toRate converts to target currency
  const converted = (amount / fromRate) * toRate
  return converted
}

/**
 * Calculate cross rate between two currencies (e.g. 1 SGD = X IDR)
 */
export function getCrossRate(
  fromCurrency: CurrencyCode | string,
  toCurrency: CurrencyCode | string,
  rates: ForexRatesMap = DEFAULT_FALLBACK_RATES
): number {
  if (fromCurrency === toCurrency) return 1
  return convertAmount(1, fromCurrency, toCurrency, rates)
}

export function parseFormattedNumber(input: string): number {
  const cleaned = input.replace(/[^0-9.-]+/g, '')
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}
