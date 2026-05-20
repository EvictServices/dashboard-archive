'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  armDashboardSidebarMenuCooldown,
  isDashboardSidebarMenuOpenBlocked,
} from '../../lib/sidebar-touch'

type GuildSettingsMobileNavContextValue = {
  mobileNavOpen: boolean
  toggleMobileNav: () => void
  closeMobileNav: () => void
}

const GuildSettingsMobileNavContext = createContext<
  GuildSettingsMobileNavContextValue | null
>(null)

export function GuildSettingsMobileNavProvider({ children }: { children: ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const closeMobileNav = useCallback(() => {
    armDashboardSidebarMenuCooldown()
    setMobileNavOpen(false)
  }, [])

  const toggleMobileNav = useCallback(() => {
    setMobileNavOpen((prev) => {
      if (prev) {
        armDashboardSidebarMenuCooldown()
        return false
      }
      if (isDashboardSidebarMenuOpenBlocked()) return false
      return true
    })
  }, [])

  const value = useMemo(
    () => ({
      mobileNavOpen,
      toggleMobileNav,
      closeMobileNav,
    }),
    [mobileNavOpen, toggleMobileNav, closeMobileNav]
  )

  return (
    <GuildSettingsMobileNavContext.Provider value={value}>
      {children}
    </GuildSettingsMobileNavContext.Provider>
  )
}

export function useGuildSettingsMobileNav() {
  const ctx = useContext(GuildSettingsMobileNavContext)
  if (!ctx) {
    throw new Error('useGuildSettingsMobileNav must be used within GuildSettingsMobileNavProvider')
  }
  return ctx
}
