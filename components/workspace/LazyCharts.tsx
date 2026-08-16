'use client'

import dynamic from 'next/dynamic'

const loading = () => <div className="h-[210px] w-full animate-pulse rounded-xl bg-[#f4f6f2]" aria-hidden="true" />

export const VolumeAreaChart = dynamic(() => import('./Charts').then(mod => mod.VolumeAreaChart), { ssr: false, loading })
export const DistributionBars = dynamic(() => import('./Charts').then(mod => mod.DistributionBars), { ssr: false, loading })
export const SavingsDonut = dynamic(() => import('./Charts').then(mod => mod.SavingsDonut), { ssr: false, loading })
