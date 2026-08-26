'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Category, TransactionType } from '@/types/database'
import { CategoryForm } from '@/components/categories/category-form'
import { DynamicIcon } from '@/components/ui/dynamic-icon'
import { Modal } from '@/components/ui/modal'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/lib/i18n/language-context'
import { formatCategoryName } from '@/lib/utils/category-i18n'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface CategoriesManagerProps {
  categories: Category[]
}

export function CategoriesManager({ categories }: CategoriesManagerProps) {
  const router = useRouter()
  const { t, language } = useLanguage()
  const [tab, setTab] = useState<TransactionType>('expense')
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const filtered = categories.filter((c) => c.type === tab)

  const handleEdit = (cat: Category) => {
    setSelectedCategory(cat)
    setIsModalOpen(true)
  }

  const handleAdd = () => {
    setSelectedCategory(null)
    setIsModalOpen(true)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Dynamic Bilingual Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-[#0F172A] dark:text-[#F8FAFC]">
          {t.categories.title}
        </h1>
        <p className="text-xs text-[#64748B] dark:text-[#94A3B8] font-mono">
          {t.categories.subtitle}
        </p>
      </div>

      {/* Tab Switcher & Add Button */}
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex p-0.5 bg-[#F1F3F5] dark:bg-[#1A1A20] rounded-lg border border-[#E5E7EB] dark:border-[#27272A] shrink-0">
          <button
            type="button"
            onClick={() => setTab('expense')}
            className={cn(
              'px-2.5 sm:px-3.5 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer',
              tab === 'expense'
                ? 'bg-[#E11D48] text-white'
                : 'text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#FAFAFA]'
            )}
          >
            {t.categories.expenseTab} ({categories.filter((c) => c.type === 'expense').length})
          </button>
          <button
            type="button"
            onClick={() => setTab('income')}
            className={cn(
              'px-2.5 sm:px-3.5 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer',
              tab === 'income'
                ? 'bg-[#0D9488] text-white'
                : 'text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#FAFAFA]'
            )}
          >
            {t.categories.incomeTab} ({categories.filter((c) => c.type === 'income').length})
          </button>
        </div>

        <Button size="sm" onClick={handleAdd} className="gap-1.5 shrink-0 whitespace-nowrap">
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{t.categories.newCategory}</span>
          <span className="sm:hidden">{language === 'en' ? 'Category' : 'Kategori'}</span>
        </Button>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <EmptyState
          icon="Tags"
          title={t.categories.emptyTitle}
          description={t.categories.emptyDesc}
          actionLabel={'+ ' + t.categories.newCategory}
          onAction={handleAdd}
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
          {filtered.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleEdit(cat)}
              className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-[#121215] border border-[#E5E7EB] dark:border-[#27272A] hover:border-[#0F172A] dark:hover:border-[#FAFAFA] transition-colors cursor-pointer text-left group min-h-[58px]"
            >
              <div className="w-8 h-8 rounded-lg bg-[#F1F3F5] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] text-[#0F172A] dark:text-[#FAFAFA] flex items-center justify-center shrink-0">
                <DynamicIcon name={cat.icon} className="w-4 h-4" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] line-clamp-2 leading-tight">
                  {formatCategoryName(cat.name, language)}
                </span>
                <span className="text-[10px] text-[#94A3B8] mt-0.5">
                  {cat.is_default ? t.common.systemDefault : t.common.custom}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedCategory(null)
        }}
        title={selectedCategory ? `${t.categories.editModalTitle}: ${selectedCategory.name}` : t.categories.modalTitle}
        maxWidth="sm"
      >
        <CategoryForm
          initialData={selectedCategory}
          onSuccess={() => {
            setIsModalOpen(false)
            setSelectedCategory(null)
            router.refresh()
          }}
        />
      </Modal>
    </div>
  )
}
