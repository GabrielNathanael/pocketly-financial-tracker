'use client'

import React, { InputHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils/cn'
import { NumberInput } from '@/components/ui/number-input'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  numberMode?: 'currency' | 'decimal'
  numberDecimalScale?: number
  numberMaxDigits?: number
  numberThousandsShortcuts?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, leftIcon, rightIcon, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

    if (props.type === 'number') {
      const {
        value,
        onChange,
        placeholder,
        required,
        disabled,
        max,
        step,
        autoFocus,
        numberMode = 'currency',
        numberDecimalScale,
        numberMaxDigits,
        numberThousandsShortcuts,
      } = props
      const stringValue = value === undefined || value === null ? '' : String(value)
      const stepText = step === undefined ? undefined : String(step)
      const decimalScale = stepText?.includes('.')
        ? stepText.split('.')[1]?.length
        : undefined

      return (
        <NumberInput
          label={label}
          value={stringValue}
          onValueChange={(nextValue) => {
            onChange?.({
              target: { value: nextValue },
              currentTarget: { value: nextValue },
            } as React.ChangeEvent<HTMLInputElement>)
          }}
          suffix={rightIcon}
          leftIcon={leftIcon}
          error={error}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          allowDecimal={numberMode === 'decimal'}
          decimalScale={numberDecimalScale ?? decimalScale}
          mode={numberMode}
          maxDigits={numberMaxDigits}
          showThousandsShortcuts={numberThousandsShortcuts}
          max={max}
          autoFocus={autoFocus}
          className={className}
        />
      )
    }

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-[11px] font-bold uppercase tracking-wider text-[#475569] dark:text-[#94A3B8]"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3 text-[#94A3B8] dark:text-[#64748B] pointer-events-none flex items-center">
              {leftIcon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className={cn(
              'w-full bg-[#F8F9FA] dark:bg-[#1A1A20] border border-[#E5E7EB] dark:border-[#27272A] text-[#0F172A] dark:text-[#F8FAFC] rounded-lg px-3.5 py-2.5 text-sm transition-colors focus:border-[#0F172A] dark:focus:border-[#FAFAFA] placeholder:text-[#94A3B8] disabled:opacity-50',
              leftIcon && 'pl-9',
              rightIcon && 'pr-9',
              error && 'border-[#E11D48] focus:border-[#E11D48]',
              className
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 text-[#94A3B8] dark:text-[#64748B] flex items-center">
              {rightIcon}
            </div>
          )}
        </div>
        {error && <p className="text-xs font-semibold text-[#E11D48] mt-0.5">{error}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'
