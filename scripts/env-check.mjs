const required=['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','SUPABASE_SERVICE_ROLE_KEY','FLOWPAY_ADMIN_EMAILS','NEXT_PUBLIC_APP_URL']
const missing=required.filter(key=>!process.env[key])
if(missing.length){console.error(`Environment check: FAIL\nMissing: ${missing.join(', ')}`);process.exit(1)}
if((process.env.SUPABASE_SERVICE_ROLE_KEY||'').startsWith('ey')===false) console.warn('Environment check: service-role key format could not be recognised; verify it manually.')
console.log('Environment check: PASS')
