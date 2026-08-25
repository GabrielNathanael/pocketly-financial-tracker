'use client'

import React from 'react'
import * as Icons from 'lucide-react'
import { LucideProps } from 'lucide-react'

interface DynamicIconProps extends Omit<LucideProps, 'name'> {
  name?: string | null
  fallback?: string
}

export function DynamicIcon({ name, fallback = 'Tag', ...props }: DynamicIconProps) {
  const iconKey = (name || fallback) as keyof typeof Icons
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const IconComponent = (Icons[iconKey] as React.ComponentType<any>) || Icons.Tag

  return <IconComponent {...props} />
}
