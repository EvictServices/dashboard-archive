'use client'

import { DashboardGuildBreadcrumbProvider } from '@/components/contexts/breadcrumb-context'
import { GuildSettingsMobileNavProvider } from '@/components/contexts/mobile-nav-context'

export default function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <GuildSettingsMobileNavProvider>
      <DashboardGuildBreadcrumbProvider>{children}</DashboardGuildBreadcrumbProvider>
    </GuildSettingsMobileNavProvider>
  )
}
