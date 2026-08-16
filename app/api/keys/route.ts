import { NextResponse } from 'next/server'
import { logSystemEvent } from '@/lib/server-log'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerClient } from '@/lib/supabase/server'

const createSchema=z.object({name:z.string().trim().min(1).max(80)})
const revokeSchema=z.object({id:z.string().uuid()})

async function sha256(value:string){const bytes=new TextEncoder().encode(value);const hash=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('')}
async function authenticate(request:Request){const auth=request.headers.get('authorization')||'';const token=auth.startsWith('Bearer ')?auth.slice(7).trim():'';if(!token)return null;const client=createServerClient(token);const {data,error}=await client.auth.getUser(token);if(error||!data.user)return null;return data.user}
function newSecret(){const bytes=crypto.getRandomValues(new Uint8Array(24));const body=Array.from(bytes).map(b=>b.toString(16).padStart(2,'0')).join('');return `fp_live_${body}`}

export async function POST(request:Request){
  try{
    const user=await authenticate(request);if(!user)return NextResponse.json({error:'UNAUTHORIZED'},{status:401})
    const parsed=createSchema.safeParse(await request.json());if(!parsed.success)return NextResponse.json({error:'INVALID_NAME'},{status:400})
    const admin=createAdminClient();const secret=newSecret();const hash=await sha256(secret)
    const {data,error}=await admin.from('api_keys').insert({user_id:user.id,name:parsed.data.name,key_prefix:secret.slice(0,17),key_hash:hash}).select('id,name,key_prefix,created_at').single()
    if(error)throw error
    return NextResponse.json({key:data,secret})
  }catch(error){console.error('api key create error',error);await logSystemEvent({level:'error',source:'api_keys',code:'KEY_CREATE_FAILED',message:error instanceof Error?error.message:String(error)});return NextResponse.json({error:'KEY_CREATE_FAILED'},{status:500})}
}

export async function DELETE(request:Request){
  try{
    const user=await authenticate(request);if(!user)return NextResponse.json({error:'UNAUTHORIZED'},{status:401})
    const parsed=revokeSchema.safeParse(await request.json());if(!parsed.success)return NextResponse.json({error:'INVALID_KEY'},{status:400})
    const admin=createAdminClient();const {error}=await admin.from('api_keys').update({revoked_at:new Date().toISOString()}).eq('id',parsed.data.id).eq('user_id',user.id)
    if(error)throw error
    return NextResponse.json({ok:true})
  }catch(error){console.error('api key revoke error',error);await logSystemEvent({level:'error',source:'api_keys',code:'KEY_REVOKE_FAILED',message:error instanceof Error?error.message:String(error)});return NextResponse.json({error:'KEY_REVOKE_FAILED'},{status:500})}
}
