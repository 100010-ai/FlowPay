import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[11px] text-[15px] font-semibold transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-[var(--fp-green)]/20 focus-visible:border-[var(--fp-green)] disabled:pointer-events-none disabled:opacity-50 active:translate-y-px',
  { variants: {
    variant: {
      default: 'bg-[var(--fp-green)] text-white shadow-[0_1px_2px_rgba(12,83,45,.18)] hover:bg-[var(--fp-green-strong)]',
      secondary: 'border border-[var(--fp-border)] bg-white text-[var(--fp-text)] hover:border-[var(--fp-border-strong)] hover:bg-[var(--fp-surface-muted)]',
      ghost: 'text-[var(--fp-muted)] hover:bg-[var(--fp-surface-hover)] hover:text-[var(--fp-text)]',
      danger: 'bg-[var(--fp-red)] text-white hover:bg-[#ae3035]',
      soft: 'bg-[var(--fp-green-soft)] text-[var(--fp-green-strong)] hover:bg-[#dfeee4]',
    },
    size: { sm: 'h-9 px-3.5', md: 'h-11 px-5', lg: 'h-12 px-6 text-[15px]', icon: 'size-9 p-0' }
  }, defaultVariants: { variant: 'default', size: 'md' } }
)

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, ...props }, ref) => <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />)
Button.displayName = 'Button'
export { buttonVariants }
