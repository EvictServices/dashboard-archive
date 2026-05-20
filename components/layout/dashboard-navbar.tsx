'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { DOCS_URL, SUPPORT_URL } from '@elira/lib/discord/urls'
import { routes } from '@/lib/routes'
import UserMenu from '@elira/components/shared/user-menu'
import { useDashboardGuildBreadcrumb } from '@/components/contexts/breadcrumb-context'
import DashboardGuildSwitcher from '@/components/guild-switcher'
import { useGuildSettingsMobileNav } from '@/components/contexts/mobile-nav-context'

const GUILD_SETTINGS_SCROLL_CLASS = 'guild-settings-mobile-scroll-away'

export default function DashboardNavbar() {
  const pathname = usePathname()
  const guildMobileScrollLastY = useRef(0)
  const { mobileNavOpen: guildDrawerOpen } = useGuildSettingsMobileNav()
  const { guildName: dashboardGuildName } = useDashboardGuildBreadcrumb()
  const isOnGuildPage = /^\/dashboard\/\d+/.test(pathname)

  useEffect(() => {
    const isGuildSettings = /^\/dashboard\/\d+/.test(pathname)
    if (!isGuildSettings) {
      document.body.classList.remove(GUILD_SETTINGS_SCROLL_CLASS)
      return
    }

    const mq = window.matchMedia('(max-width: 1024px)')
    let raf = 0
    let ticking = false

    const apply = () => {
      ticking = false
      if (!mq.matches || guildDrawerOpen) {
        document.body.classList.remove(GUILD_SETTINGS_SCROLL_CLASS)
        guildMobileScrollLastY.current = Math.max(0, window.scrollY || document.documentElement.scrollTop || 0)
        return
      }
      const y = Math.max(0, window.scrollY || document.documentElement.scrollTop || 0)
      const prev = guildMobileScrollLastY.current
      const delta = y - prev

      if (y < 12) {
        document.body.classList.remove(GUILD_SETTINGS_SCROLL_CLASS)
      } else if (delta > 10 && y > 88) {
        document.body.classList.add(GUILD_SETTINGS_SCROLL_CLASS)
      } else if (delta < -10) {
        document.body.classList.remove(GUILD_SETTINGS_SCROLL_CLASS)
      }
      guildMobileScrollLastY.current = y
    }

    const onScroll = () => {
      if (ticking) return
      ticking = true
      raf = window.requestAnimationFrame(apply)
    }

    guildMobileScrollLastY.current = Math.max(
      0,
      window.scrollY || document.documentElement.scrollTop || 0
    )
    window.addEventListener('scroll', onScroll, { passive: true })
    mq.addEventListener('change', apply)
    apply()

    return () => {
      window.cancelAnimationFrame(raf)
      ticking = false
      window.removeEventListener('scroll', onScroll)
      mq.removeEventListener('change', apply)
      document.body.classList.remove(GUILD_SETTINGS_SCROLL_CLASS)
    }
  }, [pathname, guildDrawerOpen])

  return (
    <header className="site-nav site-nav--dashboard" role="banner">
      <div className="site-nav__bar">
        <div className="site-nav__bar-inner">
          <div className="site-nav__dash-left">
            <Link href={routes.home} className="site-nav__brand site-nav__brand--icon" title="Home">
              <img src="/img/evict.webp" alt="" className="site-nav__logo" width={22} height={22} />
            </Link>
            <nav className="site-nav__path" aria-label="Breadcrumb">
              <span className="site-nav__path-seg site-nav__path-seg--muted">evict</span>
              <span className="site-nav__path-sep" aria-hidden>
                ›
              </span>
              <Link
                href={routes.dashboard}
                className={`site-nav__path-seg${pathname === '/dashboard' ? ' is-current' : ''}`}
              >
                dashboard
              </Link>
              {isOnGuildPage && (
                <>
                  <span className="site-nav__path-sep" aria-hidden>
                    ›
                  </span>
                  <span className="site-nav__path-guild">
                    <span
                      className="site-nav__path-seg is-current site-nav__path-seg--guild"
                      title={dashboardGuildName ?? undefined}
                    >
                      {dashboardGuildName ?? 'server'}
                    </span>
                    <DashboardGuildSwitcher />
                  </span>
                </>
              )}
            </nav>
          </div>
          <div className="site-nav__dash-right">
            <a href={DOCS_URL} target="_blank" rel="noopener noreferrer" className="site-nav__dash-link">
              Docs
            </a>
            <a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer" className="site-nav__dash-link">
              Support
            </a>
            <UserMenu variant="dashboard" />
          </div>
        </div>
      </div>
    </header>
  )
}
