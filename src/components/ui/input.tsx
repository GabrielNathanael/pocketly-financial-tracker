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
  currency?: string
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
        currency,
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
          allowDecimal={
            numberMode === 'decimal' || currency === 'USD' || currency === 'SGD'
          }
          decimalScale={
            numberDecimalScale ??
            decimalScale ??
            (currency === 'USD' || currency === 'SGD' ? 2 : undefined)
          }
          mode={numberMode}
          currency={currency}
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
            className="text-[11px] font-bold uppercase tracking-wider text-foreground-secondary"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3 text-foreground-muted pointer-events-none flex items-center">
              {leftIcon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className={cn(
              'w-full bg-canvas dark:bg-surface-subtle border border-border text-foreground rounded-lg px-3.5 py-2.5 text-sm transition-colors focus:border-border-strong placeholder:text-foreground-muted disabled:opacity-50',
              leftIcon && 'pl-9',
              rightIcon && 'pr-9',
              error && 'border-destructive focus:border-destructive',
              className
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 text-foreground-muted flex items-center">
              {rightIcon}
            </div>
          )}
        </div>
        {error && <p className="text-xs font-semibold text-destructive mt-0.5">{error}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'
