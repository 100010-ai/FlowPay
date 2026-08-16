'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/components/LanguageContext'
import { workspaceCopy } from '@/lib/workspace-copy'

type Option = { value: string; label: string; description?: string; leading?: React.ReactNode }

type Props = {
  value: string
  onChange: (value: string) => void
  options: Option[]
  placeholder?: string
  searchPlaceholder?: string
  className?: string
  disabled?: boolean
  variant?: 'default' | 'currency'
}

export function SearchSelect({
  value,
  onChange,
  options,
  placeholder = 'Select',
  searchPlaceholder = 'Search…',
  className,
  disabled = false,
  variant = 'default',
}: Props) {
  const { lang } = useLanguage()
  const emptyLabel = workspaceCopy[lang].common.noMatches
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [active, setActive] = React.useState(0)
  const [mounted, setMounted] = React.useState(false)
  const [rect, setRect] = React.useState<DOMRect | null>(null)
  const trigger = React.useRef<HTMLButtonElement>(null)
  const panel = React.useRef<HTMLDivElement>(null)
  const input = React.useRef<HTMLInputElement>(null)
  const selected = options.find((option) => option.value === value)
  const filtered = React.useMemo(
    () => options.filter((option) => `${option.label} ${option.value} ${option.description || ''}`.toLowerCase().includes(query.trim().toLowerCase())),
    [options, query],
  )

  React.useEffect(() => setMounted(true), [])

  const updatePosition = React.useCallback(() => {
    if (trigger.current) setRect(trigger.current.getBoundingClientRect())
  }, [])

  React.useEffect(() => {
    if (!open) return
    updatePosition()
    setActive(Math.max(0, filtered.findIndex((option) => option.value === value)))
    const update = () => updatePosition()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node
      if (!trigger.current?.contains(target) && !panel.current?.contains(target)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    requestAnimationFrame(() => input.current?.focus())
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
      document.removeEventListener('mousedown', onPointer)
    }
  }, [open, updatePosition, value, filtered])

  React.useEffect(() => {
    if (!open) return
    setActive(0)
  }, [query, open])

  function commit(option: Option | undefined) {
    if (!option) return
    onChange(option.value)
    setOpen(false)
    setQuery('')
    requestAnimationFrame(() => trigger.current?.focus())
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      trigger.current?.focus()
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((index) => Math.min(filtered.length - 1, index + 1))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((index) => Math.max(0, index - 1))
      return
    }
    if (event.key === 'Enter' && open) {
      event.preventDefault()
      commit(filtered[active])
    }
  }

  const viewportWidth = typeof window === 'undefined' ? 1200 : window.innerWidth
  const viewportHeight = typeof window === 'undefined' ? 900 : window.innerHeight
  const desiredWidth = variant === 'currency' ? Math.max(rect?.width || 0, 320) : Math.max(rect?.width || 0, 280)
  const panelWidth = Math.min(desiredWidth, Math.max(240, viewportWidth - 24))
  const spaceBelow = rect ? viewportHeight - rect.bottom : 0
  const minSpace = variant === 'currency' ? 320 : 300
  const openUp = Boolean(rect && spaceBelow < minSpace && rect.top > minSpace)
  const panelStyle: React.CSSProperties | undefined = rect
    ? {
        position: 'fixed',
        zIndex: 200,
        left: Math.max(12, Math.min(rect.left, viewportWidth - panelWidth - 12)),
        width: panelWidth,
        ...(openUp ? { bottom: viewportHeight - rect.top + 10 } : { top: rect.bottom + 10 }),
      }
    : undefined

  return <div className={cn('relative', className)}>
    <button
      ref={trigger}
      type="button"
      role="combobox"
      aria-haspopup="listbox"
      aria-expanded={open}
      disabled={disabled}
      onClick={() => setOpen((current) => !current)}
      onKeyDown={(event) => {
        if (!open && ['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
          event.preventDefault()
          setOpen(true)
        } else onKeyDown(event)
      }}
      className={cn(
        'flex h-12 w-full items-center justify-between gap-3 rounded-[12px] border border-[var(--fp-border)] bg-white px-3.5 text-left text-[15px] outline-none transition-[border-color,box-shadow,background-color] duration-150 hover:border-[var(--fp-border-strong)] focus-visible:border-[#8fb59b] focus-visible:ring-4 focus-visible:ring-[#eaf4ed] disabled:cursor-not-allowed disabled:bg-[#f5f6f3] disabled:text-[var(--fp-subtle)]',
        open && 'border-[#a7c5b0] ring-4 ring-[#eef6f0]',
      )}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        {selected?.leading && <span className={cn('shrink-0', variant === 'currency' && 'grid size-8 place-items-center rounded-[9px] bg-[#f0f4ef] text-[13px] font-semibold text-[var(--fp-green-strong)]')}>{selected.leading}</span>}
        <span className="min-w-0">
          <span className={cn('block truncate font-medium leading-5', !selected && 'font-normal text-[var(--fp-subtle)]')}>{selected?.label || placeholder}</span>
          {variant === 'currency' && selected?.description && <span className="block truncate text-[13px] leading-4 text-[var(--fp-muted)]">{selected.description}</span>}
        </span>
      </span>
      <ChevronDown size={16} className={cn('shrink-0 text-[var(--fp-subtle)] transition-transform duration-150', open && 'rotate-180 text-[var(--fp-green)]')} />
    </button>

    {mounted && open && rect && createPortal(
      <div ref={panel} style={panelStyle} onKeyDown={onKeyDown} className="fp-pop overflow-hidden rounded-[16px] border border-[#dfe4de] bg-white shadow-[0_20px_55px_rgba(18,38,25,.13)]">
        <div className="p-2.5 pb-2">
          <label className="flex h-11 items-center gap-2.5 rounded-[11px] border border-transparent bg-[#f5f7f3] px-3 transition focus-within:border-[#c8d8cd] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#eef5ef]">
            <Search size={16} className="text-[var(--fp-subtle)]" />
            <input
              ref={input}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="w-full bg-transparent text-[15px] outline-none placeholder:text-[var(--fp-subtle)]"
            />
          </label>
        </div>
        <div role="listbox" className={cn('fp-scrollbar overflow-y-auto px-2 pb-2', variant === 'currency' ? 'max-h-[292px]' : 'max-h-[280px]')}>
          {filtered.length ? filtered.map((option, index) => {
            const isSelected = option.value === value
            const isActive = index === active
            return <button
              type="button"
              role="option"
              aria-selected={isSelected}
              key={option.value}
              onMouseEnter={() => setActive(index)}
              onClick={() => commit(option)}
              className={cn(
                'group flex w-full items-center gap-3 rounded-[11px] px-3 py-2.5 text-left transition-colors',
                isActive && 'bg-[#f5f8f4]',
                isSelected && 'bg-[#edf6ef]',
              )}
            >
              {option.leading && <span className={cn('shrink-0', variant === 'currency' && 'grid size-9 place-items-center rounded-[10px] bg-white text-[13px] font-semibold text-[var(--fp-green-strong)] shadow-[inset_0_0_0_1px_#e2e8e2]')}>{option.leading}</span>}
              <span className="min-w-0 flex-1">
                <strong className={cn('block truncate text-[15px] font-semibold leading-5 text-[var(--fp-text)]', isSelected && 'text-[var(--fp-green-strong)]')}>{option.label}</strong>
                {option.description && <span className="mt-0.5 block truncate text-[13px] leading-4 text-[var(--fp-muted)]">{option.description}</span>}
              </span>
              {isSelected && <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--fp-green)] text-white"><Check size={13}/></span>}
            </button>
          }) : <div className="px-3 py-10 text-center text-[14px] text-[var(--fp-muted)]">{emptyLabel}</div>}
        </div>
      </div>,
      document.body,
    )}
  </div>
}
