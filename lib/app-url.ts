export function appBaseUrl(){
  const explicit=(process.env.NEXT_PUBLIC_APP_URL||'').trim()
  if(explicit)return explicit.replace(/\/$/,'')
  const vercel=(process.env.VERCEL_PROJECT_PRODUCTION_URL||process.env.VERCEL_URL||'').trim()
  if(vercel)return `https://${vercel.replace(/^https?:\/\//,'').replace(/\/$/,'')}`
  return 'http://localhost:3000'
}
