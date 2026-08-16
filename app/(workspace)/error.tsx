'use client'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
export default function WorkspaceError({reset}:{error:Error&{digest?:string};reset:()=>void}){return <div className="mx-auto max-w-[720px] py-16"><Card className="p-8 text-center"><span className="mx-auto grid size-11 place-items-center rounded-[12px] bg-[var(--fp-red-soft)] text-[var(--fp-red)]"><AlertTriangle size={19}/></span><h1 className="mt-4 text-[20px] font-semibold tracking-[-.03em]">Не удалось загрузить раздел</h1><p className="mt-2 text-[14px] leading-5 text-[var(--fp-muted)]">Изменения не применялись. Повторите загрузку или вернитесь в раздел позже.</p><Button className="mt-5" onClick={reset}><RefreshCw size={14}/>Повторить</Button></Card></div>}
