import { cn } from '@/lib/utils'
export function Skeleton({className}:{className?:string}){return <div className={cn('relative overflow-hidden rounded-lg bg-[#eef0ec] before:absolute before:inset-0 before:-translate-x-full before:bg-gradient-to-r before:from-transparent before:via-white/70 before:to-transparent before:animate-[fp-shimmer_1.4s_infinite]',className)}/>}
