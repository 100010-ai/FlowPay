import * as React from 'react'
import { cn } from '@/lib/utils'
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) { return <div className={cn('rounded-[16px] border border-[var(--fp-border)] bg-white shadow-[var(--fp-shadow)]', className)} {...props}/> }
export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) { return <div className={cn('flex items-start justify-between gap-4 px-6 pt-6', className)} {...props}/> }
export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) { return <h3 className={cn('text-[15px] font-semibold tracking-[-.02em] text-[var(--fp-text)]', className)} {...props}/> }
export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) { return <p className={cn('mt-1.5 text-[13px] leading-5 text-[var(--fp-muted)]', className)} {...props}/> }
export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) { return <div className={cn('p-6', className)} {...props}/> }
