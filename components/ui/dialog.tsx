'use client'

import * as React from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/components/LanguageContext'
import { workspaceCopy } from '@/lib/workspace-copy'

const focusable='button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function Dialog({open,onOpenChange,title,description,children,className}:{open:boolean;onOpenChange:(open:boolean)=>void;title:string;description?:string;children:React.ReactNode;className?:string}){
  const {lang}=useLanguage();const closeLabel=workspaceCopy[lang].common.close
  const panelRef=React.useRef<HTMLElement>(null)
  const returnFocus=React.useRef<HTMLElement|null>(null)
  const titleId=React.useId();const descriptionId=React.useId()

  React.useEffect(()=>{
    if(!open)return
    returnFocus.current=document.activeElement instanceof HTMLElement?document.activeElement:null
    const overflow=document.body.style.overflow;document.body.style.overflow='hidden'
    const onKey=(e:KeyboardEvent)=>{
      if(e.key==='Escape'){e.preventDefault();onOpenChange(false);return}
      if(e.key!=='Tab'||!panelRef.current)return
      const nodes=Array.from(panelRef.current.querySelectorAll<HTMLElement>(focusable)).filter(node=>node.offsetParent!==null)
      if(!nodes.length){e.preventDefault();panelRef.current.focus();return}
      const first=nodes[0],last=nodes[nodes.length-1]
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
    }
    document.addEventListener('keydown',onKey)
    requestAnimationFrame(()=>{const first=panelRef.current?.querySelector<HTMLElement>(focusable);(first||panelRef.current)?.focus()})
    return()=>{document.removeEventListener('keydown',onKey);document.body.style.overflow=overflow;requestAnimationFrame(()=>returnFocus.current?.focus())}
  },[open,onOpenChange])

  if(!open)return null
  return <div className="fixed inset-0 z-[100] flex items-end justify-center bg-[rgba(20,34,25,.22)] p-0 backdrop-blur-[2px] sm:items-center sm:p-6" onMouseDown={(e)=>{if(e.target===e.currentTarget)onOpenChange(false)}}>
    <section ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description?descriptionId:undefined} className={cn('fp-pop max-h-[92svh] w-full overflow-hidden rounded-t-[20px] border border-[var(--fp-border)] bg-white shadow-[var(--fp-shadow-lg)] outline-none sm:max-w-[620px] sm:rounded-[18px]',className)}>
      <header className="flex items-start justify-between border-b border-[var(--fp-border)] px-5 py-4">
        <div><h2 id={titleId} className="text-[16px] font-semibold tracking-[-.02em]">{title}</h2>{description&&<p id={descriptionId} className="mt-1 text-[14px] leading-5 text-[var(--fp-muted)]">{description}</p>}</div>
        <button type="button" className="grid size-8 shrink-0 place-items-center rounded-lg text-[var(--fp-muted)] transition-colors hover:bg-[var(--fp-surface-muted)] hover:text-[var(--fp-text)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--fp-green-soft)]" onClick={()=>onOpenChange(false)} aria-label={closeLabel}><X size={17}/></button>
      </header>
      <div className="fp-scrollbar max-h-[calc(92svh-72px)] overflow-y-auto p-5">{children}</div>
    </section>
  </div>
}
