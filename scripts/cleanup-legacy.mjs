import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'

// FlowPay v1 moved authenticated pages into app/(workspace) and replaced the
// pre-v1 shell/components. Removing these known obsolete paths makes upgrades
// safe even when a new archive is extracted over an older FlowPay directory.
const legacyPaths = [
  'app/analytics/page.tsx',
  'app/counterparties/page.tsx',
  'app/dashboard/page.tsx',
  'app/payments/page.tsx',
  'app/routes/page.tsx',
  'app/settings/page.tsx',
  'app/(workspace)/team/page.tsx',
  'components/DashboardPage.tsx',
  'components/Header.tsx',
  'components/ThemeToggle.tsx',
  'components/ui/FlowSelect.tsx',
  'components/ui/Reveal.tsx',
  'components/workspace/WorkspaceApp.tsx',
  'lib/i18n.ts',
  'components/workspace/PaymentDialog.tsx',
  'components/workspace/CounterpartyDialog.tsx',
  'components/workspace/InvoiceDialog.tsx',
]

for (const path of legacyPaths) {
  try {
    await rm(resolve(process.cwd(), path), { force: true, recursive: true })
  } catch (error) {
    console.error(`[cleanup] failed to remove legacy path: ${path}`)
    throw error
  }
}

console.log(`[cleanup] legacy FlowPay paths checked: ${legacyPaths.length}`)
