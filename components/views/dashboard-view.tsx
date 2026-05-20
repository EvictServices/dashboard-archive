'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { botInviteUrl, INVITE_URL } from '@elira/lib/discord/urls'
import { routes } from '@elira/lib/routes'
import { compactNumber, guildInitials } from '@elira/lib/discord/format'
import { userAvatarUrl } from '@elira/lib/discord/cdn'

interface DashboardUser {
  id: string
  username: string
  avatar: string | null
}

interface Guild {
  id: string
  name: string
  icon_url: string | null
  banner_url?: string | null
  member_count: number
}

interface InviteGuild {
  id: string
  name: string
  icon_url: string | null
  banner_url?: string | null
}

function inviteHref(guildId: string) {
  return botInviteUrl(guildId)
}

function bannerBackdropStyle(bannerUrl: string | null | undefined) {
  if (!bannerUrl) return undefined
  return {
    backgroundImage: `linear-gradient(135deg, rgba(8,8,10,0.78) 0%, rgba(8,8,10,0.55) 55%, rgba(8,8,10,0.78) 100%), url(${bannerUrl})`,
  } as const
}

export default function DashboardView({
  user,
  guilds,
  inviteGuilds = [],
}: {
  user: DashboardUser
  guilds: Guild[]
  inviteGuilds?: InviteGuild[]
}) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<'members' | 'name'>('members')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q
      ? guilds.filter((g) => g.name.toLowerCase().includes(q))
      : guilds.slice()
    list.sort((a, b) =>
      sort === 'members'
        ? b.member_count - a.member_count
        : a.name.localeCompare(b.name)
    )
    return list
  }, [guilds, query, sort])

  const totalMembers = useMemo(
    () => guilds.reduce((sum, g) => sum + (g.member_count || 0), 0),
    [guilds]
  )

  return (
    <section className="dashboard-section">
      <header className="dashboard-hero">
        <div className="dashboard-hero-grid">
          <div className="dashboard-hero-row">
            <span className="dashboard-hero-avatar-wrap">
              <img
                src={userAvatarUrl(user.id, user.avatar, 128)}
                alt={user.username}
                className="dashboard-hero-avatar"
              />
            </span>
            <div className="dashboard-hero-text">
              <h1 className="dashboard-hero-title">
                Welcome back, <span className="dashboard-hero-name">{user.username}</span>
              </h1>
              <p className="dashboard-hero-subtitle">
                Pick a server to manage its modules, permissions, and behavior.
              </p>
            </div>
          </div>

          <div className="dashboard-hero-cta">
            <a
              href={INVITE_URL}
              target="_blank"
              rel="noopener"
              className="btn btn-primary dashboard-hero-cta-btn"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add to a server
            </a>
          </div>
        </div>

        <div className="dashboard-stats">
          <div className="dashboard-stat">
            <span className="dashboard-stat-icon" aria-hidden>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="4" width="18" height="16" rx="3" />
                <path d="M3 10h18M8 4v16" />
              </svg>
            </span>
            <div className="dashboard-stat-body">
              <span className="dashboard-stat-value">{guilds.length}</span>
              <span className="dashboard-stat-label">Servers</span>
            </div>
          </div>
          <div className="dashboard-stat-divider" />
          <div className="dashboard-stat">
            <span className="dashboard-stat-icon" aria-hidden>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </span>
            <div className="dashboard-stat-body">
              <span className="dashboard-stat-value">{compactNumber(totalMembers)}</span>
              <span className="dashboard-stat-label">Members</span>
            </div>
          </div>
        </div>
      </header>

      <div className="dashboard-toolbar">
        <div className="dashboard-search">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search servers"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="dashboard-search-input"
          />
          {query && (
            <button
              type="button"
              className="dashboard-search-clear"
              onClick={() => setQuery('')}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>

        <div className="dashboard-sort">
          <button
            type="button"
            className={`dashboard-sort-btn${sort === 'members' ? ' active' : ''}`}
            onClick={() => setSort('members')}
          >
            Largest
          </button>
          <button
            type="button"
            className={`dashboard-sort-btn${sort === 'name' ? ' active' : ''}`}
            onClick={() => setSort('name')}
          >
            A–Z
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="dashboard-empty">
          {guilds.length === 0 ? (
            <>
              <h3 className="dashboard-empty-title">No mutual servers yet</h3>
              <p className="dashboard-empty-desc">
                Invite evict to a server you administrate to start managing it
                from this dashboard.
              </p>
              <a
                href={INVITE_URL}
                target="_blank"
                rel="noopener"
                className="btn btn-primary"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Add to a server
              </a>
            </>
          ) : (
            <>
              <h3 className="dashboard-empty-title">No matches</h3>
              <p className="dashboard-empty-desc">
                Nothing in your servers list matches &ldquo;{query}&rdquo;.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="guild-grid">
          {filtered.map((guild, idx) => (
            <Link
              key={guild.id}
              href={routes.guild(guild.id)}
              className={`guild-card${guild.banner_url ? ' guild-card-has-banner' : ''}`}
              style={{ animationDelay: `${Math.min(idx * 0.04, 0.4)}s` }}
            >
              {guild.banner_url && (
                <div
                  className="guild-card-banner"
                  style={bannerBackdropStyle(guild.banner_url)}
                  aria-hidden
                />
              )}
              <div className="guild-card-icon">
                {guild.icon_url ? (
                  <img
                    src={guild.icon_url}
                    alt={guild.name}
                    className="guild-icon"
                  />
                ) : (
                  <div className="guild-icon guild-icon-placeholder">
                    {guildInitials(guild.name)}
                  </div>
                )}
              </div>
              <div className="guild-card-body">
                <span className="guild-name">{guild.name}</span>
                <span className="guild-members">
                  {guild.member_count
                    ? `${guild.member_count.toLocaleString()} members`
                    : 'Member count unavailable'}
                </span>
              </div>
              <span className="guild-card-arrow" aria-hidden>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </span>
            </Link>
          ))}
        </div>
      )}

      {inviteGuilds.length > 0 && (
        <section className="dashboard-invite">
          <header className="dashboard-invite-header">
            <div>
              <span className="section-badge dashboard-invite-eyebrow">
                Add evict
              </span>
              <h2 className="dashboard-invite-title">Servers you can add evict to</h2>
              <p className="dashboard-invite-desc">
                You have <strong>Manage Server</strong> on these — invite evict to start
                managing them from here.
              </p>
            </div>
            <span className="dashboard-invite-count">{inviteGuilds.length}</span>
          </header>

          <div className="guild-grid">
            {inviteGuilds.map((guild, idx) => (
              <div
                key={guild.id}
                className={`guild-card guild-card-invite${guild.banner_url ? ' guild-card-has-banner' : ''}`}
                style={{ animationDelay: `${Math.min(idx * 0.04, 0.4)}s` }}
              >
                {guild.banner_url && (
                  <div
                    className="guild-card-banner"
                    style={bannerBackdropStyle(guild.banner_url)}
                    aria-hidden
                  />
                )}
                <div className="guild-card-icon">
                  {guild.icon_url ? (
                    <img
                      src={guild.icon_url}
                      alt=""
                      className="guild-icon"
                    />
                  ) : (
                    <div className="guild-icon guild-icon-placeholder">
                      {guildInitials(guild.name)}
                    </div>
                  )}
                </div>
                <div className="guild-card-body">
                  <span className="guild-name">{guild.name}</span>
                  <span className="guild-members">Bot not in this server</span>
                </div>
                <a
                  href={inviteHref(guild.id)}
                  target="_blank"
                  rel="noopener"
                  className="guild-card-invite-btn"
                  aria-label={`Invite evict to ${guild.name}`}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  Invite
                </a>
              </div>
            ))}
          </div>
        </section>
      )}

      <footer className="dashboard-footer">
        <span className="dashboard-footer-hint">
          Don&apos;t see a server? Make sure you have the{' '}
          <strong>Manage Server</strong> permission and that evict is in it.
        </span>
        <a
          href={INVITE_URL}
          target="_blank"
          rel="noopener"
          className="dashboard-footer-link"
        >
          Add to another server →
        </a>
      </footer>
    </section>
  )
}
