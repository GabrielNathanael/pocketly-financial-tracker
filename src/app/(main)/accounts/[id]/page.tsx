import React from 'react'
import { notFound } from 'next/navigation'
import { getAccountById, getAccountMutations, getAccounts } from '@/actions/accounts'
import { AccountDetailView } from '@/components/accounts/account-detail-view'

export const dynamic = 'force-dynamic'

interface AccountDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function AccountDetailPage({ params }: AccountDetailPageProps) {
  const { id } = await params
  const [account, mutations, accounts] = await Promise.all([
    getAccountById(id),
    getAccountMutations(id),
    getAccounts(),
  ])

  if (!account) {
    notFound()
  }

  return <AccountDetailView account={account} mutations={mutations} accounts={accounts} />
}
