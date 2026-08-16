'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export type SelectMenuOption = {
  value: string
  label: string
  description?: string
  leading?: React.ReactNode
}

type Props = {
  value: string
  onChange: (value: string) => void
  options: SelectMenuOption[]
  placeholder?: string
  className?: string
  triggerClassName?: string
  panelClassName?: string
  disabled?: boolean
  align?: 'left' | 'right'
  compact?: boolean
  ariaLabel?: string
}

export function SelectMenu({
  value,
  onChange,
  options,
  placeholder = 'Select',
  className,
  triggerClassName,
  panelClassName,
  disabled = false,
  align = 'left',
  compact = false,
  ariaLabel,
}: Props) {
  const [open, setOpen] = React.useState(false)
  const [mounted, setMounted] = React.useState(false)
  const [rect, setRect] = React.useState<DOMRect | null>(null)
  const trigger = React.useRef<HTMLButtonElement>(null)
  const panel = React.useRef<HTMLDivElement>(null)
  const selected = options.find((option) => option.value === value)

  React.useEffect(() => setMounted(true), [])

  const update = React.useCallback(() => {
    if (trigger.current) setRect(trigger.current.getBoundingClientRect())
  }, [])

  React.useEffect(() => {
    if (!open) return
    update()
    const onLayout = () => update()
    const onPointer = (event: MouseEvent) => {
      const node = event.target as Node
      if (!trigger.current?.contains(node) && !panel.current?.contains(node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        trigger.current?.focus()
      }
    }
    window.addEventListener('resize', onLayout)
    window.addEventListener('scroll', onLayout, true)
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('resize', onLayout)
      window.removeEventListener('scroll', onLayout, true)
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, update])

  const viewportWidth = typeof window === 'undefined' ? 1200 : window.innerWidth
  const viewportHeight = typeof window === 'undefined' ? 900 : window.innerHeight
  const width = Math.min(Math.max(rect?.width || 0, compact ? 150 : 220), Math.max(180, viewportWidth - 24))
  const spaceBelow = rect ? viewportHeight - rect.bottom : 0
  const openUp = Boolean(rect && spaceBelow < 250 && rect.top > 250)
  const left = rect
    ? align === 'right'
      ? Math.max(12, Math.min(rect.right - width, viewportWidth - width - 12))
      : Math.max(12, Math.min(rect.left, viewportWidth - width - 12))
    : 12
  const style: React.CSSProperties | undefined = rect
    ? {
        position: 'fixed',
        zIndex: 180,
        left,
        width,
        ...(openUp ? { bottom: viewportHeight - rect.top + 8 } : { top: rect.bottom + 8 }),
      }
    : undefined

  function commit(option: SelectMenuOption) {
    onChange(option.value)
    setOpen(false)
    requestAnimationFrame(() => trigger.current?.focus())
  }

  return <div className={cn('relative', className)}>
    <button
      ref={trigger}
      type="button"
      role="combobox"
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => setOpen((v) => !v)}
      className={cn(
        'flex h-11 w-full items-center justify-between gap-2 rounded-[10px] border border-[var(--fp-border)] bg-white px-3 text-left text-[15px] outline-none transition-[border-color,box-shadow,background-color] duration-150 hover:border-[var(--fp-border-strong)] focus-visible:border-[#9fb4a5] focus-visible:ring-4 focus-visible:ring-[var(--fp-green-soft)] disabled:cursor-not-allowed disabled:bg-[#f5f6f3] disabled:text-[var(--fp-subtle)]',
        compact && 'h-10 rounded-[10px] px-3 text-[14px]',
        triggerClassName,
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        {selected?.leading && <span className="shrink-0">{selected.leading}</span>}
        <span className={cn('min-w-0 truncate', !selected && 'text-[var(--fp-subtle)]')}>{selected?.label || placeholder}</span>
      </span>
      <ChevronDown size={13} className={cn('shrink-0 text-[var(--fp-subtle)] transition-transform duration-150', open && 'rotate-180')} />
    </button>

    {mounted && open && rect && createPortal(
      <div ref={panel} style={style} role="listbox" className={cn('fp-pop overflow-hidden rounded-[12px] border border-[var(--fp-border)] bg-white p-1.5 shadow-[var(--fp-shadow-lg)]', panelClassName)}>
        {options.map((option) => {
          const active = option.value === value
          return <button
            key={option.value}
            type="button"
            role="option"
            aria-selected={active}
            onClick={() => commit(option)}
            className={cn('flex w-full items-center gap-2 rounded-[8px] px-2.5 py-2 text-left text-[15px] transition-colors hover:bg-[var(--fp-surface-muted)]', active && 'bg-[var(--fp-green-soft)] text-[var(--fp-green-strong)]')}
          >
            {option.leading && <span className="shrink-0">{option.leading}</span>}
            <span className="min-w-0 flex-1">
              <strong className="block truncate font-medium">{option.label}</strong>
              {option.description && <small className="block truncate text-[13px] text-[var(--fp-muted)]">{option.description}</small>}
            </span>
            {active && <Check size={13} className="shrink-0 text-[var(--fp-green)]" />}
          </button>
        })}
      </div>,
      document.body,
    )}
  </div>
}
