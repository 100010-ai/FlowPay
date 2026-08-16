import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const base=(process.env.NEXT_PUBLIC_APP_URL||'').replace(/\/$/,'')
  return {
    rules:[{userAgent:'*',allow:'/',disallow:['/dashboard','/payments','/counterparties','/routes','/analytics','/reports','/invoices','/developer','/settings','/admin','/onboarding']}],
    ...(base?{sitemap:`${base}/sitemap.xml`}:{}),
  }
}
