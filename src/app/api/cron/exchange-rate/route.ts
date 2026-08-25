import { NextResponse } from 'next/server'
import { fetchAndSaveExchangeRate } from '@/actions/exchange-rate'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const rate = await fetchAndSaveExchangeRate()
    return NextResponse.json({
      success: true,
      rate,
      base: 'USD',
      target: 'IDR',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    )
  }
}
