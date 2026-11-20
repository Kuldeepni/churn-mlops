import type { ReactNode } from 'react'
import { Reveal } from './Reveal'

interface SectionHeaderProps {
  overline: string
  title: ReactNode
  description?: ReactNode
  aside?: ReactNode
  id?: string
}

export function SectionHeader({ overline, title, description, aside, id }: SectionHeaderProps) {
  return (
    <Reveal>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="max-w-[62ch]" id={id}>
          <div className="overline">{overline}</div>
          <h2 className="display mt-3 text-[clamp(2rem,1.35rem+2.4vw,3.4rem)] leading-[1.05] tracking-[-0.03em] text-ink">
            {title}
          </h2>
          {description ? <p className="mt-4 max-w-[58ch] text-[16px] leading-[1.65] text-muted text-pretty">{description}</p> : null}
        </div>
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </div>
    </Reveal>
  )
}
