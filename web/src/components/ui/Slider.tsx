import { useId } from 'react'
import * as SliderPrimitive from '@radix-ui/react-slider'
import { cn } from '../../lib/utils'

interface SliderProps {
  label: string
  value: number
  onValueChange: (value: number) => void
  min: number
  max: number
  step: number
  format?: (value: number) => string
  hint?: string
  className?: string
}

export function Slider({
  label,
  value,
  onValueChange,
  min,
  max,
  step,
  format,
  hint,
  className,
}: SliderProps) {
  const id = useId()
  return (
    <div className={cn('space-y-2.5', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label id={`${id}-label`} className="text-[13px] font-medium text-muted">
          {label}
        </label>
        <output className="mono rounded-md border border-border bg-bg px-2 py-1 text-[12px] font-medium text-ink">
          {format ? format(value) : value}
        </output>
      </div>
      <SliderPrimitive.Root
        value={[value]}
        onValueChange={([next]) => onValueChange(next)}
        min={min}
        max={max}
        step={step}
        aria-labelledby={`${id}-label`}
        className="relative flex h-6 w-full touch-none select-none items-center"
      >
        <SliderPrimitive.Track className="relative h-1 w-full grow overflow-hidden rounded-full bg-border-strong">
          <SliderPrimitive.Range className="absolute h-full rounded-full bg-accent" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb className="block h-4 w-4 rounded-full border-2 border-accent bg-surface shadow-[0_0_0_3px_var(--bg)] transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg" />
      </SliderPrimitive.Root>
      <div className="flex items-center justify-between text-[11px] text-faint">
        <span className="mono">{format ? format(min) : min}</span>
        {hint ? <span className="text-center">{hint}</span> : null}
        <span className="mono">{format ? format(max) : max}</span>
      </div>
    </div>
  )
}
