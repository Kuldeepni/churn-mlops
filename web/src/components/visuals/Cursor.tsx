import { useEffect, useRef } from 'react'

/** A quiet trailing ring for fine pointers. The native cursor stays visible. */
export function Cursor() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const fine = window.matchMedia('(pointer: fine)').matches
    const node = ref.current
    if (reduced || !fine || !node) return

    let targetX = -100
    let targetY = -100
    let x = -100
    let y = -100
    let frame = 0
    let visible = false

    const onMove = (event: PointerEvent) => {
      targetX = event.clientX
      targetY = event.clientY
      if (!visible) {
        visible = true
        node.style.opacity = '1'
        x = targetX
        y = targetY
      }
      const interactive = (event.target as HTMLElement | null)?.closest(
        'a, button, [role="button"], [role="radio"], input, select, textarea, [data-cursor]',
      )
      node.style.width = interactive ? '34px' : '18px'
      node.style.height = interactive ? '34px' : '18px'
      node.style.borderColor = interactive ? 'var(--accent)' : 'var(--text-faint)'
    }
    const onLeave = () => {
      visible = false
      node.style.opacity = '0'
    }

    const render = () => {
      x += (targetX - x) * 0.18
      y += (targetY - y) * 0.18
      node.style.transform = `translate3d(${x - 9}px, ${y - 9}px, 0)`
      frame = requestAnimationFrame(render)
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('pointerleave', onLeave)
    frame = requestAnimationFrame(render)

    return () => {
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerleave', onLeave)
      cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-[80] hidden rounded-full border opacity-0 mix-blend-difference transition-[width,height,border-color,opacity] duration-200 md:block"
      style={{ width: 18, height: 18, borderColor: 'var(--text-faint)' }}
    />
  )
}
