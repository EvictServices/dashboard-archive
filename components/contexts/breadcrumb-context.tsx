'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

type DashboardGuildBreadcrumbContextValue = {
  guildName: string | null
  setGuildBreadcrumbName: (name: string | null) => void
}

const DashboardGuildBreadcrumbContext =
  createContext<DashboardGuildBreadcrumbContextValue | null>(null)

export function DashboardGuildBreadcrumbProvider({ children }: { children: ReactNode }) {
  const [guildName, setGuildName] = useState<string | null>(null)

  const setGuildBreadcrumbName = useCallback((name: string | null) => {
    setGuildName(name)
  }, [])

  const value = useMemo(
    () => ({ guildName, setGuildBreadcrumbName }),
    [guildName, setGuildBreadcrumbName]
  )

  return (
    <DashboardGuildBreadcrumbContext.Provider value={value}>
      {children}
    </DashboardGuildBreadcrumbContext.Provider>
  )
}

export function useDashboardGuildBreadcrumb() {
  const ctx = useContext(DashboardGuildBreadcrumbContext)
  if (!ctx) {
    throw new Error('useDashboardGuildBreadcrumb must be used within DashboardGuildBreadcrumbProvider')
  }
  return ctx
}
