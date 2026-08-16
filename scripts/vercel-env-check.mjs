// Local builds are allowed without production credentials. On Vercel, however,
// a deployment without the Supabase credentials would produce a broken app.
if (!process.env.VERCEL) process.exit(0)

const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
]
const missing = required.filter(key => !String(process.env[key] || '').trim())
if (missing.length) {
  console.error('\nFlowPay: Vercel deployment остановлен, потому что отсутствуют обязательные переменные окружения:')
  for (const key of missing) console.error(`- ${key}`)
  console.error('\nОткройте Vercel → Project → Settings → Environment Variables, добавьте их для нужного окружения и запустите Redeploy.\n')
  process.exit(1)
}
