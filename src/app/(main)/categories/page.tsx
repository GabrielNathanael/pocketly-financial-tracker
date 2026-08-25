import React from 'react'
import { getCategories } from '@/actions/categories'
import { CategoriesManager } from '@/components/categories/categories-manager'

export const dynamic = 'force-dynamic'

export default async function CategoriesPage() {
  const categories = await getCategories()

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-[#0F172A] dark:text-[#F8FAFC]">
          Kelola Kategori
        </h1>
        <p className="text-xs text-[#64748B] dark:text-[#94A3B8] font-mono">
          Kategori kustom untuk pos pengeluaran dan pemasukan transaksi
        </p>
      </div>

      <CategoriesManager categories={categories} />
    </div>
  )
}
