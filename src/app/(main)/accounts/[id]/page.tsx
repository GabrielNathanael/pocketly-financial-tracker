import React, { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { getAccountById, getAccountMutations, getAccounts } from '@/actions/accounts'
import { AccountDetailView } from '@/components/accounts/account-detail-view'
import { AccountDetailSkeleton } from '@/components/accounts/account-detail-skeleton'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50

interface AccountDetailPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ page?: string; start?: string; end?: string }>
}

async function AccountDetailContent({
  id,
  page,
  start,
  end,
}: {
  id: string
  page: number
  start?: string
  end?: string
}) {
  const [account, accounts, result] = await Promise.all([
    getAccountById(id),
    getAccounts(),
    getAccountMutations(id, {
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
      start,
      end,
    }),
  ])

  if (!account) {
    notFound()
  }

  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)

  // If requested page is beyond range (e.g. item deleted), refetch last page
  let mutations = result.mutations
  let total = result.total
  if (safePage !== page) {
    const last = await getAccountMutations(id, {
      limit: PAGE_SIZE,
      offset: (safePage - 1) * PAGE_SIZE,
      start,
      end,
    })
    mutations = last.mutations
    total = last.total
  }

  return (
    <AccountDetailView
      account={account}
      mutations={mutations}
      totalMutations={total}
      page={safePage}
      totalPages={totalPages}
      startDate={start || ''}
      endDate={end || ''}
      accounts={accounts}
    />
  )
}

export default async function AccountDetailPage({ params, searchParams }: AccountDetailPageProps) {
  const { id } = await params
  const { page, start, end } = await searchParams
  const currentPage = Math.max(1, Number(page) || 1)
  return (
    <Suspense fallback={<AccountDetailSkeleton />}>
      <AccountDetailContent id={id} page={currentPage} start={start} end={end} />
    </Suspense>
  )
}
