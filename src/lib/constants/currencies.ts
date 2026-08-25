export type CurrencyCode = 'IDR' | 'USD' | 'SGD'

export interface CurrencyConfig {
  code: CurrencyCode
  symbol: string
  name: string
  decimals: number
}

export const SUPPORTED_CURRENCIES: Record<CurrencyCode, CurrencyConfig> = {
  IDR: {
    code: 'IDR',
    symbol: 'Rp',
    name: 'Indonesian Rupiah',
    decimals: 0,
  },
  USD: {
    code: 'USD',
    symbol: '$',
    name: 'US Dollar',
    decimals: 2,
  },
  SGD: {
    code: 'SGD',
    symbol: 'S$',
    name: 'Singapore Dollar',
    decimals: 2,
  },
}

export const CURRENCY_LIST = Object.values(SUPPORTED_CURRENCIES)

export const DEFAULT_CURRENCY: CurrencyCode = 'IDR'
