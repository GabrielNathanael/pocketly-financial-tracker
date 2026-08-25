import React from 'react'
import { getCategories } from '@/actions/categories'
import { CategoriesManager } from '@/components/categories/categories-manager'

export const dynamic = 'force-dynamic'

export default async function CategoriesPage() {
  const categories = await getCategories()

  return (
    <div className="flex flex-col gap-4">
      <CategoriesManager categories={categories} />
    </div>
  )
}
