'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Account } from '@/types/database'
import { Modal } from '@/components/ui/modal'
import { AccountForm } from '@/components/accounts/account-form'
import { Settings } from 'lucide-react'

export function AccountEditTrigger({ account }: { account: Account }) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="p-2 rounded-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        title="Edit Account"
      >
        <Settings className="w-5 h-5" />
      </button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Edit Account" maxWidth="md">
        <AccountForm
          initialData={account}
          onSuccess={() => {
            setIsOpen(false)
            router.refresh()
          }}
        />
      </Modal>
    </>
  )
}
