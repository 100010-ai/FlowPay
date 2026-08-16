import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)) }

export function initials(value?: string | null) {
  return (value || 'FlowPay').trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}

export function clamp(value: number, min = 0, max = 100) { return Math.min(max, Math.max(min, value)) }
