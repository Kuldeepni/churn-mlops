import { useId } from 'react'
import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '../../lib/utils'

interface SelectProps {
  label: string
  value: string
  onValueChange: (value: string) => void
  options: readonly string[]
  hint?: string
  className?: string
}

export function Select({ label, value, onValueChange, options, hint, className }: SelectProps) {
  const id = useId()
  return (
    <div className={cn('space-y-1.5', className)}>
      <label id={`${id}-label`} className="block text-[13px] font-medium text-muted">
        {label}
      </label>
      <SelectPrimitive.Root value={value} onValueChange={onValueChange}>
        <SelectPrimitive.Trigger
          aria-labelledby={`${id}-label`}
          className="input flex items-center justify-between gap-2 text-left focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-soft"
        >
          <SelectPrimitive.Value />
          <SelectPrimitive.Icon>
            <ChevronDown size={15} className="text-faint" aria-hidden="true" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            position="popper"
            sideOffset={6}
            className="z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-[10px] border border-border bg-surface shadow-[0_18px_50px_rgba(0,0,0,0.28)]"
          >
            <SelectPrimitive.Viewport className="p-1">
              {options.map((option) => (
                <SelectPrimitive.Item
                  key={option}
                  value={option}
                  className="relative flex h-9 cursor-pointer select-none items-center rounded-[6px] px-8 text-[13px] text-ink outline-none data-[highlighted]:bg-surface-2 data-[state=checked]:text-accent"
                >
                  <SelectPrimitive.ItemIndicator className="absolute left-2 inline-flex">
                    <Check size={14} aria-hidden="true" />
                  </SelectPrimitive.ItemIndicator>
                  <SelectPrimitive.ItemText>{option}</SelectPrimitive.ItemText>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
      {hint ? <p className="text-[11px] leading-4 text-faint">{hint}</p> : null}
    </div>
  )
}
