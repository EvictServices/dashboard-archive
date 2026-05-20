'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { usePathname, useRouter } from 'next/navigation'
import { useDashboardGuildBreadcrumb } from '@/components/contexts/breadcrumb-context'
import { useGuildSettingsMobileNav } from '@/components/contexts/mobile-nav-context'
import { useMediaQuery } from '@elira/lib/hooks/use-media-query'
import { routes } from '@/lib/routes'
import { guildInitials } from '@elira/lib/discord/format'
import { userAvatarUrl as discordUserAvatarUrl } from '@elira/lib/discord/cdn'

const DisabledCommandsSettings = dynamic(() => import('@/components/settings/DisabledCommandsSettings'))
const AntinukeSettings = dynamic(() => import('@/components/settings/AntinukeSettings'))
const LoggingSettings = dynamic(() => import('@/components/settings/LoggingSettings'))
const AutoroleSettings = dynamic(() => import('@/components/settings/AutoroleSettings'))
const VoicemasterSettings = dynamic(() => import('@/components/settings/VoicemasterSettings'))
const AuditLogSettings = dynamic(() => import('@/components/settings/AuditLogSettings'))
const SystemMessagesSettings = dynamic(() => import('@/components/settings/SystemMessagesSettings'))
const TicketsSettings = dynamic(() => import('@/components/settings/TicketsSettings'))
const InvokeSettings = dynamic(() => import('@/components/settings/InvokeSettings'))
const RewardsSettings = dynamic(() => import('@/components/settings/RewardsSettings'))

interface Guild {
  guild_id: string
  name: string
  icon_url: string | null
  banner_url: string | null
  vanity_url_code?: string | null
  owner_id: string
  member_count: number
  [key: string]: unknown
}

interface User {
  id: string
  username: string
  avatar: string | null
  email: string | null
  serverCount: number
}

function userAvatarUrl(user: User) {
  return discordUserAvatarUrl(user.id, user.avatar, 64)
}

interface SidebarSection {
  label: string
  items: { id: string; label: string; icon: React.ReactNode }[]
}

const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg
    className={`sidebar-chevron${open ? ' open' : ''}`}
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
)

const sections: SidebarSection[] = [
  {
    label: 'Configuration',
    items: [
      {
        id: 'general',
        label: 'General',
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </svg>
        ),
      },
      {
        id: 'audit',
        label: 'Audit log',
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <path d="M12 18v-6" />
            <path d="M9 15h6" />
          </svg>
        ),
      },
    ],
  },
  {
    label: 'Moderation',
    items: [
      {
        id: 'logging',
        label: 'Logging',
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
          </svg>
        ),
      },
      {
        id: 'invoke',
        label: 'Invoke',
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="4 17 10 11 4 5" />
            <line x1="12" y1="19" x2="20" y2="19" />
          </svg>
        ),
      },
      {
        id: 'antinuke',
        label: 'Antinuke',
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        ),
      },
    ],
  },
  {
    label: 'Engagement',
    items: [
      {
        id: 'system',
        label: 'System Messages',
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
          </svg>
        ),
      },
      {
        id: 'starboard',
        label: 'Starboard',
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        ),
      },
      {
        id: 'rewards',
        label: 'Rewards',
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" />
            <path d="M4 6v12c0 1.1.9 2 2 2h14v-4" />
            <path d="M18 12a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" />
          </svg>
        ),
      },
    ],
  },
  {
    label: 'Features',
    items: [
      {
        id: 'voicemaster',
        label: 'VoiceMaster',
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        ),
      },
      {
        id: 'tickets',
        label: 'Tickets',
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        ),
      },
    ],
  },
]

const sectionDescriptions: Record<string, string> = {
  general: 'Core server options, including the command prefix.',
  audit: 'Review changes made from this dashboard.',
  logging: 'Set up event logging channels.',
  invoke: 'Customize the messages the bot sends after moderation actions (kick, ban, mute, and more).',
  antinuke: 'Protect your server from malicious actions by rogue administrators.',
  system: 'Welcome, boost, and leave messages, plus automatic roles when members join.',
  starboard: 'Highlight popular messages in a starboard channel.',
  rewards: 'Reward members who rep your server tag or vanity invite.',
  voicemaster: 'Create temporary voice channels on demand.',
  tickets: 'Set up a support ticket system.',
}

export default function ServerSettingsView({ guild, user, activeTab, canAccessAntinuke }: { guild: Guild; user: User; activeTab: string; canAccessAntinuke: boolean }) {
  const activeItem = activeTab
  const pathname = usePathname()
  const router = useRouter()
  const isMobile = useMediaQuery('(max-width: 1024px)')
  const { mobileNavOpen, closeMobileNav, toggleMobileNav } = useGuildSettingsMobileNav()
  const { setGuildBreadcrumbName } = useDashboardGuildBreadcrumb()
  const swipeCloseRef = useRef<{ x: number } | null>(null)

  useLayoutEffect(() => {
    setGuildBreadcrumbName(guild.name)
    return () => setGuildBreadcrumbName(null)
  }, [guild.guild_id, guild.name, setGuildBreadcrumbName])

  const filteredSections = canAccessAntinuke
    ? sections
    : sections.map((s) => ({
        ...s,
        items: s.items.filter((i) => i.id !== 'antinuke'),
      }))
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(sections.map((s) => [s.label, true]))
  )

  const toggleSection = (label: string) => {
    setOpenSections((prev) => ({ ...prev, [label]: !prev[label] }))
  }

  const navigateToTab = useCallback(
    (itemId: string) => {
      closeMobileNav()
      const href = routes.guild(guild.guild_id, itemId)
      router.push(href)
    },
    [closeMobileNav, guild.guild_id, router]
  )

  const goBackToServers = useCallback(() => {
    closeMobileNav()
    router.push(routes.dashboard)
  }, [closeMobileNav, router])

  useEffect(() => {
    closeMobileNav()
  }, [activeTab, pathname, closeMobileNav])

  useEffect(() => {
    if (!isMobile || !mobileNavOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [isMobile, mobileNavOpen])

  useEffect(() => {
    if (!mobileNavOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMobileNav()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileNavOpen, closeMobileNav])

  const sidebarClass = ['server-sidebar', mobileNavOpen && 'server-sidebar--mobile-open']
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={
        'server-layout' + (mobileNavOpen ? ' server-layout--mobile-nav-open' : '')
      }
    >
      <div className="server-settings-mobile-bar">
        <button
          type="button"
          className={`server-mobile-menu-trigger${mobileNavOpen ? ' server-mobile-menu-trigger--close' : ''}`}
          onClick={toggleMobileNav}
          aria-expanded={mobileNavOpen}
          aria-controls="server-settings-sidebar"
          aria-label={mobileNavOpen ? 'Close server menu' : 'Open server menu'}
        >
          {mobileNavOpen ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="18" x2="20" y2="18" />
            </svg>
          )}
        </button>
        <span className="server-settings-mobile-bar__title">{guild.name}</span>
      </div>
      {mobileNavOpen && (
        <button
          type="button"
          className="server-sidebar-backdrop"
          aria-label="Close menu"
          onClick={closeMobileNav}
        />
      )}
      <aside
        className={sidebarClass}
        id="server-settings-sidebar"
        onTouchStart={(e) => {
          if (typeof window === 'undefined' || !window.matchMedia('(max-width: 1024px)').matches) {
            return
          }
          swipeCloseRef.current = { x: e.touches[0].clientX }
        }}
        onTouchEnd={(e) => {
          if (typeof window === 'undefined' || !window.matchMedia('(max-width: 1024px)').matches) {
            return
          }
          const start = swipeCloseRef.current
          swipeCloseRef.current = null
          if (!start || !mobileNavOpen) return
          const end = e.changedTouches[0].clientX
          if (end - start.x < -56) closeMobileNav()
        }}
      >
        <button
          type="button"
          className="server-sidebar-back-chip"
          onClick={goBackToServers}
          aria-label="Back to all servers"
        >
          <svg
            className="server-sidebar-back-chip-chevron"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
          >
            <path
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 18l-6-6 6-6"
            />
          </svg>
          <span className="server-sidebar-back-chip-label">Servers</span>
        </button>

        <div className={`sidebar-guild${guild.banner_url ? ' sidebar-guild--with-banner' : ''}`}>
          {guild.banner_url && (
            <div className="sidebar-guild-banner" aria-hidden>
              <img src={guild.banner_url} alt="" className="sidebar-guild-banner-img" />
            </div>
          )}
          <div className="sidebar-guild-row">
            {guild.icon_url ? (
              <img src={guild.icon_url} alt={guild.name} className="sidebar-guild-icon" />
            ) : (
              <div className="sidebar-guild-icon sidebar-guild-icon-placeholder">
                {guildInitials(guild.name)}
              </div>
            )}
            <div className="sidebar-guild-info">
              <span className="sidebar-guild-name">
                {guild.name}
                {(guild.boost_level as number) > 0 && (
                  <svg className={`sidebar-boost-badge boost-level-${guild.boost_level as number}`} width="16" height="16" viewBox="0 0 24 24" role="img" aria-label={`Server Boost Level ${guild.boost_level as number}`}>
                    <title>{`Server Boost Level ${guild.boost_level as number}`}</title>
                    <path fill="currentColor" d="M3.06 9.72c.18-.18.42-.18.6-.06l.06.06 2.22 2.22V5.34c0-.24.18-.42.42-.48h.06c.24 0 .42.18.48.42v6.66l2.22-2.22c.18-.18.42-.18.6 0 .18.18.18.42.06.6l-.06.06-3 3c-.06.06-.12.06-.18.06h-.12s-.06 0-.12-.06l-3-3c-.18-.12-.24-.42-.06-.6Zm17.88 4.56c-.18.18-.42.18-.6.06l-.06-.06-2.22-2.22v6.6c0 .24-.18.42-.42.48h-.06c-.24 0-.42-.18-.48-.42v-6.66l-2.22 2.22c-.18.18-.42.18-.6 0-.18-.18-.18-.42-.06-.6l.06-.06 3-3c.06-.06.12-.06.18-.06h.12s.06 0 .12.06l3 3c.18.12.24.42.06.6Z" />
                  </svg>
                )}
              </span>
              <span className="sidebar-guild-meta">{guild.member_count.toLocaleString()} members</span>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {filteredSections.map((section) => (
            <div key={section.label} className="sidebar-section">
              <button
                className="sidebar-section-toggle"
                onClick={() => toggleSection(section.label)}
              >
                <span>{section.label}</span>
                <ChevronIcon open={openSections[section.label]} />
              </button>
              <div className={`sidebar-section-items${openSections[section.label] ? ' open' : ''}`}>
                <div className="sidebar-section-items-inner">
                  {section.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`sidebar-item${activeItem === item.id ? ' active' : ''}`}
                      aria-current={activeItem === item.id ? 'page' : undefined}
                      onClick={() => navigateToTab(item.id)}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </nav>

        <div className="sidebar-user">
          <img src={userAvatarUrl(user)} alt={user.username} className="sidebar-user-avatar" />
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{user.username}</span>
            {user.email && <span className="sidebar-user-email">{user.email}</span>}
            <span className="sidebar-user-servers">{user.serverCount} server{user.serverCount !== 1 ? 's' : ''}</span>
          </div>
          <a href="/api/auth/logout" className="sidebar-user-logout" title="Log out">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </a>
        </div>
      </aside>

      <main className="server-content">
        <header className="server-content-header">
          <h1 className="server-content-title">
            {sections.flatMap((s) => s.items).find((i) => i.id === activeItem)?.label}
          </h1>
          {sectionDescriptions[activeItem] && (
            <p className="server-content-desc">{sectionDescriptions[activeItem]}</p>
          )}
        </header>
        <div className="server-content-body">
          {activeItem === 'general' && <DisabledCommandsSettings guildId={guild.guild_id} />}
          {activeItem === 'audit' && <AuditLogSettings guildId={guild.guild_id} />}
          {activeItem === 'antinuke' && (
            <AntinukeSettings
              guildId={guild.guild_id}
              ownerId={guild.owner_id}
              currentUserId={user.id}
            />
          )}
          {activeItem === 'logging' && <LoggingSettings guildId={guild.guild_id} />}
          {activeItem === 'invoke' && (
            <InvokeSettings
              guildId={guild.guild_id}
              guildName={guild.name}
              guildIconUrl={guild.icon_url}
              guildBannerUrl={guild.banner_url}
              user={{
                id: user.id,
                username: user.username,
                display_name: user.username,
                avatar_url: userAvatarUrl(user),
              }}
            />
          )}
          {activeItem === 'rewards' && (
            <RewardsSettings
              guildId={guild.guild_id}
              guildName={guild.name}
              guildIconUrl={guild.icon_url}
              guildBannerUrl={guild.banner_url}
              vanityUrlCode={
                guild.vanity_url_code != null && String(guild.vanity_url_code).trim() !== ''
                  ? String(guild.vanity_url_code).trim()
                  : null
              }
              user={{
                id: user.id,
                username: user.username,
                display_name: user.username,
                avatar_url: userAvatarUrl(user),
              }}
            />
          )}
          {activeItem === 'voicemaster' && <VoicemasterSettings guildId={guild.guild_id} />}
          {activeItem === 'tickets' && <TicketsSettings guildId={guild.guild_id} />}
          {activeItem === 'system' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              <SystemMessagesSettings
                guildId={guild.guild_id}
                guildName={guild.name}
                guildIconUrl={guild.icon_url}
                guildBannerUrl={guild.banner_url}
                user={{
                  id: user.id,
                  username: user.username,
                  display_name: user.username,
                  avatar_url: userAvatarUrl(user),
                }}
              />
              <AutoroleSettings guildId={guild.guild_id} />
            </div>
          )}
          {activeItem !== 'general' &&
            activeItem !== 'audit' &&
            activeItem !== 'antinuke' &&
            activeItem !== 'logging' &&
            activeItem !== 'invoke' &&
            activeItem !== 'rewards' &&
            activeItem !== 'voicemaster' &&
            activeItem !== 'tickets' &&
            activeItem !== 'system' && (
              <p className="server-content-placeholder">Settings for this section coming soon.</p>
            )}
        </div>
      </main>
    </div>
  )
}
