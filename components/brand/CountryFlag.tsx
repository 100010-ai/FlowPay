import type { ComponentType } from 'react'
import * as Flags from 'country-flag-icons/react/3x2'
import { cn } from '@/lib/utils'

type Props={code?:string|null;className?:string;title?:string}
export function CountryFlag({code,className,title}:Props){if(!code)return null;const key=code.toUpperCase() as keyof typeof Flags;const Flag=Flags[key] as unknown as ComponentType<{title?:string;className?:string}>|undefined;if(!Flag)return null;return <span className={cn('inline-flex h-[14px] w-[20px] shrink-0 overflow-hidden rounded-[2px] ring-1 ring-black/5',className)}><Flag title={title||code.toUpperCase()} className="h-full w-full object-cover"/></span>}
