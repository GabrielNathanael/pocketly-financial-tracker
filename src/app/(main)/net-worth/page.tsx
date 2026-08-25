import React from 'react'
import { getNetWorthData } from '@/actions/exchange-rate'
import { NetWorthView } from '@/components/net-worth/net-worth-view'

export const dynamic = 'force-dynamic'

export default async function NetWorthPage() {
  const data = await getNetWorthData()

  return <NetWorthView data={data} />
}
