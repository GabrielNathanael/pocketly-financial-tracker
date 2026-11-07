import React, { Suspense } from 'react'
import { getNetWorthData, getNetWorthSnapshots } from '@/actions/exchange-rate'
import { NetWorthView } from '@/components/net-worth/net-worth-view'
import { NetWorthSkeleton } from '@/components/net-worth/net-worth-skeleton'

export const dynamic = 'force-dynamic'

async function NetWorthContent() {
  const [data, snapshots] = await Promise.all([
    getNetWorthData(),
    getNetWorthSnapshots(),
  ])

  return <NetWorthView data={data} snapshots={snapshots} />
}

export default function NetWorthPage() {
  return (
    <Suspense fallback={<NetWorthSkeleton />}>
      <NetWorthContent />
    </Suspense>
  )
}
