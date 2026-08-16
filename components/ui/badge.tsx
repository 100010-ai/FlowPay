import * as React from 'react'
import { cn } from '@/lib/utils'
export type BadgeTone = 'neutral'|'success'|'info'|'warning'|'danger'
const tones:Record<BadgeTone,string>={neutral:'bg-[#f1f2ef] text-[#5e6761]',success:'bg-[var(--fp-green-soft)] text-[var(--fp-green-strong)]',info:'bg-[var(--fp-blue-soft)] text-[var(--fp-blue)]',warning:'bg-[var(--fp-amber-soft)] text-[var(--fp-amber)]',danger:'bg-[var(--fp-red-soft)] text-[var(--fp-red)]'}
export function Badge({ tone='neutral', className, ...props }: React.HTMLAttributes<HTMLSpanElement>&{tone?:BadgeTone}) { return <span className={cn('inline-flex h-6 items-center rounded-full px-2.5 text-[13px] font-semibold capitalize',tones[tone],className)} {...props}/> }
