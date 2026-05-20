'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { api, routes } from '@elira/lib/routes'

type GuildRow = { id: string; name: string; icon_url: string | null; member_count: number }

function RowIcon({ iconUrl, name }: { iconUrl: string | null; name: string }) {
  if (iconUrl) {
    return (
      <img
        src={iconUrl}
        alt=""
        className="site-nav__guild-switcher-icon"
        width={24}
        height={24}
        loading="lazy"
      />
    )
  }
  return (
    <span className="site-nav__guild-switcher-icon-placeholder" aria-hidden>
      {name.trim().slice(0, 1).toUpperCase() || '?'}
    </span>
  )
}

export default function DashboardGuildSwitcher() {
  const pathname = usePathname()
  const match = pathname.match(/^\/dashboard\/(\d+)\/([^/]+)/)
  const activeGuildId = match?.[1] ?? null
  const activeTab = match?.[2] ?? 'general'

  const [guilds, setGuilds] = useState<GuildRow[] | null>(null)
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!activeGuildId) {
      setGuilds(null)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(api.guilds, { credentials: 'same-origin' })
        if (!res.ok) return
        const data = (await res.json()) as { guilds: GuildRow[] }
        const list = [...(data.guilds ?? [])].sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
        )
        if (!cancelled) setGuilds(list)
      } catch {
        if (!cancelled) setGuilds(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [activeGuildId])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!activeGuildId || !guilds || guilds.length <= 1) {
    return null
  }

  return (
    <div
      ref={wrapRef}
      className={`site-nav__guild-switcher an-dropdown${open ? ' open' : ''}`}
    >
      <button
        type="button"
        className="site-nav__guild-switcher-trigger an-dropdown-trigger"
        aria-label="Switch server"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((o) => !o)}
      >
        <svg
          className="an-dropdown-chevron site-nav__guild-switcher-chevron"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="an-dropdown-menu site-nav__guild-switcher-menu" role="listbox" aria-label="Servers">
          {guilds.map((g) => {
            const isActive = g.id === activeGuildId
            return (
              <Link
                key={g.id}
                href={routes.guild(g.id, activeTab)}
                role="option"
                aria-selected={isActive}
                className={`an-dropdown-item site-nav__guild-switcher-item${isActive ? ' active' : ''}`}
                onClick={() => setOpen(false)}
              >
                <span className="site-nav__guild-switcher-row">
                  <RowIcon iconUrl={g.icon_url} name={g.name} />
                  <span className="site-nav__guild-switcher-name">{g.name}</span>
                </span>
                {isActive && (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="site-nav__guild-switcher-check"
                    aria-hidden
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
