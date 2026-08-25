'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Category, TransactionType } from '@/types/database'
import { createCategory, updateCategory, deleteCategory } from '@/actions/categories'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { AVAILABLE_ICONS } from '@/lib/constants/default-categories'
import { DynamicIcon } from '@/components/ui/dynamic-icon'
import { useLanguage } from '@/lib/i18n/language-context'
import { toast } from 'sonner'
import { Trash2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface CategoryFormProps {
  initialData?: Category | null
  onSuccess?: () => void
}

export function CategoryForm({ initialData, onSuccess }: CategoryFormProps) {
  const router = useRouter()
  const { t, language } = useLanguage()
  const isEditing = !!initialData

  const [name, setName] = useState(initialData?.name || '')
  const [type, setType] = useState<TransactionType>(initialData?.type || 'expense')
  const [icon, setIcon] = useState<string>(initialData?.icon || 'Tag')

  const [isLoading, setIsLoading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError(t.categories.nameLabel + ' is required')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      if (isEditing && initialData) {
        const res = await updateCategory(initialData.id, {
          name,
          type,
          icon,
        })
        if (res.error) {
          setError(res.error)
          return
        }
      } else {
        const res = await createCategory({
          name,
          type,
          icon,
        })
        if (res.error) {
          setError(res.error)
          return
        }
      }

      if (onSuccess) {
        onSuccess()
      } else {
        router.push('/categories')
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!initialData) return
    setIsDeleting(true)
    setShowDeleteConfirm(false)
    setError(null)

    try {
      const res = await deleteCategory(initialData.id)
      if (res.error) {
        setError(res.error)
      } else {
        toast.success(
          language === 'en' ? 'Category deleted successfully' : 'Kategori berhasil dihapus'
        )
        if (onSuccess) {
          onSuccess()
        } else {
          router.push('/categories')
        }
      }
    } catch (err) {
      const msg = (err as Error).message
      setError(msg)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-medium flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="leading-relaxed">{error}</span>
        </div>
      )}

      {/* Type Toggle */}
      {!isEditing && (
        <div className="grid grid-cols-2 p-1 bg-[#F1F3F5] dark:bg-[#1A1A20] rounded-lg border border-[#E5E7EB] dark:border-[#27272A]">
          <button
            type="button"
            onClick={() => setType('expense')}
            className={cn(
              'py-2 rounded-md font-bold text-xs transition-colors cursor-pointer text-center',
              type === 'expense'
                ? 'bg-[#E11D48] text-white'
                : 'text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]'
            )}
          >
            {t.quickAdd.expense}
          </button>
          <button
            type="button"
            onClick={() => setType('income')}
            className={cn(
              'py-2 rounded-md font-bold text-xs transition-colors cursor-pointer text-center',
              type === 'income'
                ? 'bg-[#0D9488] text-white'
                : 'text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]'
            )}
          >
            {t.quickAdd.income}
          </button>
        </div>
      )}

      <Input
        label={t.categories.nameLabel}
        type="text"
        placeholder={t.categories.namePlaceholder}
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />

      {/* Icon Picker Grid */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
          {t.categories.iconLabel}
        </label>
        <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 max-h-40 overflow-y-auto p-0.5">
          {AVAILABLE_ICONS.map((ic) => (
            <button
              key={ic}
              type="button"
              onClick={() => setIcon(ic)}
              className={cn(
                'p-2 rounded-lg border flex items-center justify-center transition-colors cursor-pointer',
                icon === ic
                  ? 'border-[#0F172A] bg-[#0F172A] text-white dark:border-[#FAFAFA] dark:bg-[#FAFAFA] dark:text-[#0F172A]'
                  : 'border-[#E5E7EB] dark:border-[#27272A] bg-[#F8F9FA] dark:bg-[#1A1A20] text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F1F3F5] dark:hover:bg-[#26262E]'
              )}
            >
              <DynamicIcon name={ic} className="w-4 h-4" />
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 pt-2">
        {isEditing && (
          <Button
            type="button"
            variant="danger"
            onClick={() => setShowDeleteConfirm(true)}
            className="px-3"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
        <Button type="submit" isLoading={isLoading} className="flex-1">
          {isEditing ? t.categories.saveBtn : t.categories.createBtn}
        </Button>
      </div>

      {isEditing && (
        <ConfirmDialog
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={handleDelete}
          isLoading={isDeleting}
          title={t.categories.deleteConfirmTitle}
          message={t.categories.deleteConfirmMsg}
        />
      )}
    </form>
  )
}
