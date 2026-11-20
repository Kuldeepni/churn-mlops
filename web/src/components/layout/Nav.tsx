import { useEffect, useState } from 'react'
import { Github, Menu, Moon, Star, Sun } from 'lucide-react'
import { siteConfig } from '../../config/site'
import { useActiveSection } from '../../hooks/useActiveSection'
import { useTheme } from '../../hooks/useTheme'
import type { ApiStatus } from '../../hooks/useApiStatus'
import { cn } from '../../lib/utils'
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '../ui/Dialog'
import { Tooltip } from '../ui/Tooltip'
import { Logo } from '../visuals/Logo'

const SECTION_IDS = siteConfig.nav.map((item) => item.id)

const STATUS_COPY: Record<ApiStatus, { label: string; short: string; dot: string; detail: string }> = {
  checking: {
    label: 'Checking',
    short: 'Checking',
    dot: 'bg-faint',
    detail: 'Checking the model server. This usually takes a few seconds.',
  },
  waking: {
    label: 'Waking',
    short: 'Waking',
    dot: 'bg-warning pulse-dot',
    detail: 'The free-tier model server is waking up. It can take up to 90 seconds.',
  },
  online: {
    label: 'Live API',
    short: 'Live',
    dot: 'bg-success',
    detail: 'Live inference from the FastAPI model server.',
  },
  offline: {
    label: 'Demo mode',
    short: 'Demo',
    dot: 'bg-danger',
    detail: 'The free-tier API is asleep. Precomputed predictions from the held-out test set are shown.',
  },
}

export function Nav({ status }: { status: ApiStatus }) {
  const { theme, toggle } = useTheme()
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const active = useActiveSection(SECTION_IDS)
  const copy = STATUS_COPY[status]

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const ThemeIcon = theme === 'dark' ? Sun : Moon

  return (
    <header
      className={cn(
        'sticky top-0 z-40 border-b backdrop-blur-xl transition-colors duration-300',
        scrolled ? 'border-border bg-bg/85' : 'border-transparent bg-bg/60',
      )}
    >
      <div className="container-page flex h-14 items-center gap-5">
        <a href="#top" className="shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
          <Logo />
        </a>

        <nav aria-label="Sections" className="ml-4 hidden items-center gap-1 md:flex">
          {siteConfig.nav.map((item) => {
            const isActive = active === item.id
            return (
              <a
                key={item.id}
                href={`#${item.id}`}
                aria-current={isActive ? 'location' : undefined}
                className={cn(
                  'relative rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors',
                  isActive ? 'text-ink' : 'text-faint hover:text-ink',
                )}
              >
                {item.label}
                <span
                  className={cn(
                    'absolute inset-x-2.5 -bottom-[1px] h-px origin-left bg-accent transition-transform duration-300',
                    isActive ? 'scale-x-100' : 'scale-x-0',
                  )}
                  aria-hidden="true"
                />
              </a>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <Tooltip content={copy.detail}>
            <span
              className="inline-flex h-8 items-center gap-2 rounded-full border border-border bg-surface px-2.5 text-[11px] font-medium text-muted"
              role="status"
              aria-live="polite"
              tabIndex={0}
              aria-label={`${copy.label}. ${copy.detail}`}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', copy.dot)} aria-hidden="true" />
              <span className="hidden sm:inline">{copy.label}</span>
              <span className="sr-only sm:hidden">{copy.label}</span>
              <span className="sm:hidden" aria-hidden="true">
                {copy.short}
              </span>
            </span>
          </Tooltip>

          <button
            type="button"
            onClick={toggle}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-faint transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <ThemeIcon size={17} aria-hidden="true" />
          </button>

          <a
            href={siteConfig.githubUrl}
            target="_blank"
            rel="noreferrer"
            className="hidden h-9 items-center gap-1.5 rounded-btn border border-border px-3 text-[13px] font-medium text-muted transition-colors hover:border-border-strong hover:bg-surface-2 hover:text-ink sm:inline-flex"
          >
            <Github size={14} aria-hidden="true" />
            GitHub
            <Star size={12} className="text-faint" aria-hidden="true" />
          </a>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <button
                type="button"
                aria-label="Open menu"
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:hidden"
              >
                <Menu size={19} aria-hidden="true" />
              </button>
            </DialogTrigger>
            <DialogContent title="Menu">
              <div className="pr-12">
                <Logo />
              </div>
              <nav aria-label="Mobile sections" className="mt-6 flex flex-col">
                {siteConfig.nav.map((item, index) => (
                  <DialogClose asChild key={item.id}>
                    <a
                      href={`#${item.id}`}
                      className="flex items-center justify-between border-b border-border py-4 text-[18px] font-medium text-ink"
                    >
                      <span>{item.label}</span>
                      <span className="mono text-[11px] text-faint">0{index + 1}</span>
                    </a>
                  </DialogClose>
                ))}
              </nav>
              <div className="mt-6 flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-[12px] text-muted">
                  <span className={cn('h-1.5 w-1.5 rounded-full', copy.dot)} aria-hidden="true" />
                  {copy.label}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggle}
                    className="inline-flex h-11 items-center gap-2 rounded-btn border border-border px-3 text-[13px] text-muted"
                  >
                    <ThemeIcon size={15} aria-hidden="true" />
                    {theme === 'dark' ? 'Light' : 'Dark'}
                  </button>
                  <a
                    href={siteConfig.githubUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-11 items-center gap-2 rounded-btn border border-border px-3 text-[13px] text-muted"
                  >
                    <Github size={15} aria-hidden="true" />
                    GitHub
                  </a>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </header>
  )
}
