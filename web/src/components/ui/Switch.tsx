import { useId } from 'react'
import * as SwitchPrimitive from '@radix-ui/react-switch'
import { cn } from '../../lib/utils'

interface SwitchProps {
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  description?: string
  className?: string
}

export function Switch({ label, checked, onCheckedChange, description, className }: SwitchProps) {
  const id = useId()
  return (
    <div className={cn('flex items-center justify-between gap-4', className)}>
      <div className="min-w-0">
        <label htmlFor={id} className="block text-[13px] font-medium text-muted">
          {label}
        </label>
        {description ? <p className="mt-0.5 text-[11px] leading-4 text-faint">{description}</p> : null}
      </div>
      <SwitchPrimitive.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="relative h-6 w-10 shrink-0 rounded-full border border-border-strong bg-surface-2 transition-colors data-[state=checked]:border-accent data-[state=checked]:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        <SwitchPrimitive.Thumb className="block h-4 w-4 translate-x-1 rounded-full bg-text shadow-sm transition-transform duration-200 data-[state=checked]:translate-x-5 data-[state=checked]:bg-accent-ink" />
      </SwitchPrimitive.Root>
    </div>
  )
}
