import type { Metadata, Viewport } from 'next'
import { headers } from 'next/headers'
import '@fontsource-variable/inter'
import './globals.css'
import { LanguageProvider } from '@/components/LanguageContext'

export const metadata: Metadata = {
  title: { default: 'FlowPay', template: '%s · FlowPay' },
  description: 'Compare international business payment options, manage counterparties and track payment operations with FlowPay.',
  applicationName: 'FlowPay',
  manifest: '/manifest.webmanifest',
  robots: { index: true, follow: true },
  openGraph: { title: 'FlowPay', description: 'International business payment operations, routing and analytics.', type: 'website' },
  twitter: { card: 'summary', title: 'FlowPay', description: 'International business payment operations, routing and analytics.' },
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#fafaf7', colorScheme: 'light' }

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Reading request headers opts HTML rendering into the request path so Next can
  // propagate the middleware nonce to all framework scripts.
  await headers()
  return <html lang="ru"><body><LanguageProvider>{children}</LanguageProvider></body></html>
}
