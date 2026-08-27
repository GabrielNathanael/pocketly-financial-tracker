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
      const numPart = new Intl.NumberFormat('en-SG', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(absValue)
      formatted = `S$${numPart}`
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
  const numericAmount = Number(amount) || 0
  if (!numericAmount) return 0

  const from = (fromCurrency || 'IDR').toUpperCase()
  const to = (toCurrency || 'IDR').toUpperCase()

  if (from === to) return numericAmount

  // Construct complete rate matrix with USD as 1.0 base
  const rateMatrix: ForexRatesMap =
    typeof rates === 'number'
      ? { ...DEFAULT_FALLBACK_RATES, IDR: rates > 100 ? rates : (DEFAULT_FALLBACK_RATES.IDR || 16200), USD: 1 }
      : { ...DEFAULT_FALLBACK_RATES, ...rates }

  const fromRate = rateMatrix[from] ?? (from === 'USD' ? 1 : from === 'IDR' ? 16200 : 1.34)
  const toRate = rateMatrix[to] ?? (to === 'USD' ? 1 : to === 'IDR' ? 16200 : 1.34)

  if (!fromRate || !toRate) return numericAmount

  // (numericAmount / fromRate) converts to USD base, then * toRate converts to target currency
  return (numericAmount / fromRate) * toRate
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

/**
 * Formats a currency pair exchange rate in a human-friendly natural convention.
 * The stronger currency (or foreign currency relative to IDR) is placed on the left as 1 unit.
 * Example:
 * - from IDR to SGD => "1 SGD = Rp 11.850"
 * - from USD to IDR => "1 USD = Rp 16.200"
 * - from USD to SGD => "1 USD = S$ 1.34"
 */
export function formatNaturalForexRate(
  fromCurrency: string,
  toCurrency: string,
  exchangeRateUsed: number
): {
  baseCurrency: string
  quoteCurrency: string
  rateValue: number
  formattedText: string
} {
  const from = (fromCurrency || 'IDR').toUpperCase()
  const to = (toCurrency || 'IDR').toUpperCase()
  const rawRate = Number(exchangeRateUsed) || 1

  if (from === to) {
    return {
      baseCurrency: from,
      quoteCurrency: to,
      rateValue: 1,
      formattedText: `1 ${from} = 1 ${to}`,
    }
  }

  // If one of the currencies is IDR:
  if (from === 'IDR' || to === 'IDR') {
    const foreign = from === 'IDR' ? to : from
    // Calculate how many IDR is 1 Foreign currency
    const idrPerForeign = from === 'IDR' ? (rawRate !== 0 ? 1 / rawRate : 16200) : rawRate
    const formattedIdr = formatCurrency(idrPerForeign, 'IDR')
    return {
      baseCurrency: foreign,
      quoteCurrency: 'IDR',
      rateValue: idrPerForeign,
      formattedText: `1 ${foreign} = ${formattedIdr}`,
    }
  }

  // For other foreign pairs (e.g. USD vs SGD):
  if (rawRate < 1 && rawRate > 0) {
    const invRate = 1 / rawRate
    return {
      baseCurrency: to,
      quoteCurrency: from,
      rateValue: invRate,
      formattedText: `1 ${to} = ${formatCurrency(invRate, from)}`,
    }
  }

  return {
    baseCurrency: from,
    quoteCurrency: to,
    rateValue: rawRate,
    formattedText: `1 ${from} = ${formatCurrency(rawRate, to)}`,
  }
}

/**
 * Get natural currency pair metadata and helper calculation functions.
 * E.g., for IDR <-> SGD, base is SGD and quote is IDR (1 SGD = X IDR).
 */
export function getNaturalPairInfo(
  fromCurrency: string,
  toCurrency: string,
  rates: ForexRatesMap = DEFAULT_FALLBACK_RATES
) {
  const from = (fromCurrency || 'IDR').toUpperCase()
  const to = (toCurrency || 'IDR').toUpperCase()

  if (from === to) {
    return {
      baseCurrency: from,
      quoteCurrency: to,
      isFromBase: true,
      defaultRate: 1,
      calculateReceived: (sent: number) => sent,
      calculateSent: (recv: number) => recv,
      calculateNaturalRate: () => 1,
    }
  }

  // If one of the currencies is IDR
  if (from === 'IDR' || to === 'IDR') {
    const foreign = from === 'IDR' ? to : from
    const idrPerForeign = getCrossRate(foreign, 'IDR', rates)
    const isFromIdr = from === 'IDR'

    return {
      baseCurrency: foreign,
      quoteCurrency: 'IDR',
      isFromBase: !isFromIdr,
      defaultRate: idrPerForeign > 0 ? idrPerForeign : (foreign === 'USD' ? 16200 : 12000),
      calculateReceived: (sent: number, naturalRate: number) => {
        if (!naturalRate || naturalRate <= 0) return 0
        return isFromIdr ? sent / naturalRate : sent * naturalRate
      },
      calculateSent: (recv: number, naturalRate: number) => {
        if (!naturalRate || naturalRate <= 0) return 0
        return isFromIdr ? recv * naturalRate : recv / naturalRate
      },
      calculateNaturalRate: (sent: number, recv: number) => {
        if (!sent || !recv || recv <= 0 || sent <= 0) return 0
        return isFromIdr ? sent / recv : recv / sent
      },
    }
  }

  // For other foreign pairs (e.g. USD vs SGD)
  const usdRateFrom = getCrossRate('USD', from, rates)
  const usdRateTo = getCrossRate('USD', to, rates)
  const base = from === 'USD' || to === 'USD' ? 'USD' : usdRateFrom <= usdRateTo ? from : to
  const quote = base === from ? to : from
  const defaultRate = getCrossRate(base, quote, rates)
  const isFromBase = from === base

  return {
    baseCurrency: base,
    quoteCurrency: quote,
    isFromBase,
    defaultRate: defaultRate > 0 ? defaultRate : 1.34,
    calculateReceived: (sent: number, naturalRate: number) => {
      if (!naturalRate || naturalRate <= 0) return 0
      return isFromBase ? sent * naturalRate : sent / naturalRate
    },
    calculateSent: (recv: number, naturalRate: number) => {
      if (!naturalRate || naturalRate <= 0) return 0
      return isFromBase ? recv / naturalRate : recv * naturalRate
    },
    calculateNaturalRate: (sent: number, recv: number) => {
      if (!sent || !recv || recv <= 0 || sent <= 0) return 0
      return isFromBase ? recv / sent : sent / recv
    },
  }
}

export function parseFormattedNumber(input: string): number {
  const cleaned = input.replace(/[^0-9.-]+/g, '')
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}
