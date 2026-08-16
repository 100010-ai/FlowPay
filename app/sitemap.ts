import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const base=(process.env.NEXT_PUBLIC_APP_URL||'').replace(/\/$/,'')
  if(!base)return []
  const now=new Date()
  return [
    {url:base,lastModified:now,changeFrequency:'weekly',priority:1},
    {url:`${base}/security`,lastModified:now,changeFrequency:'monthly',priority:.5},
    {url:`${base}/privacy`,lastModified:now,changeFrequency:'monthly',priority:.4},
    {url:`${base}/terms`,lastModified:now,changeFrequency:'monthly',priority:.4},
    {url:`${base}/status`,lastModified:now,changeFrequency:'daily',priority:.4},
  ]
}
