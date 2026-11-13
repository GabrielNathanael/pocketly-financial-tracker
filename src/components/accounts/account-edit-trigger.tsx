'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Account } from '@/types/database'
import { Modal } from '@/components/ui/modal'
import { AccountForm } from '@/components/accounts/account-form'
import { useLanguage } from '@/lib/i18n/language-context'
import { Settings } from 'lucide-react'

export function AccountEditTrigger({ account }: { account: Account }) {
  const router = useRouter()
  const { t } = useLanguage()
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="p-2 rounded-xl text-foreground-secondary hover:text-foreground hover:bg-surface-subtle transition-colors cursor-pointer"
        title={t.accounts.modalEditTitle || 'Edit Account'}
      >
        <Settings className="w-5 h-5" />
      </button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={t.accounts.modalEditTitle || 'Edit Account'}
        maxWidth="md"
      >
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
