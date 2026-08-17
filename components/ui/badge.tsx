import * as React from 'react'
import { cn } from '@/lib/utils'
export type BadgeTone = 'neutral'|'success'|'info'|'warning'|'danger'
const tones:Record<BadgeTone,string>={
  neutral:'border-[#e1e5e0] bg-[#f4f5f2] text-[#59625c]',
  success:'border-[#cfe2d4] bg-[var(--fp-green-soft)] text-[var(--fp-green-strong)]',
  info:'border-[#cedce9] bg-[var(--fp-blue-soft)] text-[var(--fp-blue)]',
  warning:'border-[#eadcbc] bg-[var(--fp-amber-soft)] text-[var(--fp-amber)]',
  danger:'border-[#efcfd2] bg-[var(--fp-red-soft)] text-[var(--fp-red)]',
}
export function Badge({ tone='neutral', className, ...props }: React.HTMLAttributes<HTMLSpanElement>&{tone?:BadgeTone}) {
  return <span className={cn('inline-flex h-[26px] min-h-[26px] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[8px] border px-2.5 align-middle text-[12px] font-semibold leading-none tracking-[-.01em] tabular-nums',tones[tone],className)} {...props}/>
}
