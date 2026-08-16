import { NextRequest, NextResponse } from 'next/server'

// Strict nonce-based CSP is reserved for authenticated financial surfaces.
// Public marketing pages remain statically cacheable under the baseline CSP
// configured in next.config.ts.
export function middleware(request: NextRequest) {
  const nonce = crypto.randomUUID().replaceAll('-', '')
  const isDev = process.env.NODE_ENV !== 'production'
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "worker-src 'self' blob:",
    ...(isDev ? [] : ['upgrade-insecure-requests']),
  ].join('; ')

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', csp)
  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('Content-Security-Policy', csp)
  response.headers.set('Cache-Control', 'private, no-store, max-age=0')
  return response
}

export const config = {
  matcher: [
    '/dashboard/:path*','/payments/:path*','/counterparties/:path*','/routes/:path*',
    '/analytics/:path*','/reports/:path*','/invoices/:path*','/developer/:path*',
    '/settings/:path*','/admin/:path*','/onboarding/:path*','/reset-password/:path*','/login/:path*',
  ],
}
