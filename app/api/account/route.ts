import { NextResponse } from 'next/server'
import { authenticatedUser } from '@/lib/server-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit } from '@/lib/rate-limit'
import { logSystemEvent } from '@/lib/server-log'

export async function DELETE(request:Request){
  const rate=await checkRateLimit(request,'account_delete',3,3600);if(!rate.available)return NextResponse.json({error:'SERVICE_UNAVAILABLE'},{status:503});if(!rate.allowed)return NextResponse.json({error:'RATE_LIMITED'},{status:429})
  const user=await authenticatedUser(request);if(!user)return NextResponse.json({error:'UNAUTHORIZED'},{status:401})
  try{const admin=createAdminClient();const {error}=await admin.auth.admin.deleteUser(user.id);if(error)throw error;return NextResponse.json({ok:true})}
  catch(error){await logSystemEvent({level:'error',source:'account',code:'ACCOUNT_DELETE_FAILED',message:error instanceof Error?error.message:String(error),userId:user.id});return NextResponse.json({error:'ACCOUNT_DELETE_FAILED'},{status:500})}
}
