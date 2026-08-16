const env=process.env
const required=['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','NEXT_PUBLIC_APP_URL']
const missing=required.filter(key=>!env[key]?.trim())
if(!env.SUPABASE_SECRET_KEY&&!env.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY)')
if(!env.FLOWPAY_ADMIN_USER_IDS&&!env.FLOWPAY_ADMIN_EMAILS) missing.push('FLOWPAY_ADMIN_USER_IDS (or fallback FLOWPAY_ADMIN_EMAILS)')
if(missing.length){console.error(`Environment check: FAIL\nMissing: ${missing.join(', ')}`);process.exit(1)}

const errors=[]
try { const u=new URL(env.NEXT_PUBLIC_SUPABASE_URL); if(u.protocol!=='https:') errors.push('NEXT_PUBLIC_SUPABASE_URL must use HTTPS') } catch { errors.push('NEXT_PUBLIC_SUPABASE_URL is not a valid URL') }
try { const u=new URL(env.NEXT_PUBLIC_APP_URL); if(env.NODE_ENV==='production'&&u.protocol!=='https:') errors.push('NEXT_PUBLIC_APP_URL must use HTTPS in production') } catch { errors.push('NEXT_PUBLIC_APP_URL is not a valid URL') }
if(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.startsWith('sb_secret_')) errors.push('A secret Supabase key was placed in NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')
if(env.SUPABASE_SECRET_KEY?.startsWith('sb_publishable_')) errors.push('SUPABASE_SECRET_KEY contains a publishable key')
if(env.CRON_SECRET && env.CRON_SECRET.length < 32) errors.push('CRON_SECRET must be at least 32 characters')
if(env.FLOWPAY_ADMIN_USER_IDS){
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  for(const id of env.FLOWPAY_ADMIN_USER_IDS.split(',').map(x=>x.trim()).filter(Boolean)) if(!uuid.test(id)) errors.push(`Invalid admin UUID: ${id}`)
}
if(errors.length){console.error(`Environment check: FAIL\n- ${errors.join('\n- ')}`);process.exit(1)}
if(!env.SUPABASE_SECRET_KEY&&env.SUPABASE_SERVICE_ROLE_KEY) console.warn('Environment check: legacy SUPABASE_SERVICE_ROLE_KEY is configured; migrate to SUPABASE_SECRET_KEY when available.')
if(!env.FLOWPAY_ADMIN_USER_IDS&&env.FLOWPAY_ADMIN_EMAILS) console.warn('Environment check: admin access uses confirmed-email fallback. Prefer FLOWPAY_ADMIN_USER_IDS before production.')
if(!env.CRON_SECRET) console.warn('Environment check: CRON_SECRET is not set; scheduled operational-data pruning will return 401 until configured.')
console.log('Environment check: PASS')
