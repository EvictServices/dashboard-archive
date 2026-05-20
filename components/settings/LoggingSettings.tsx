'use client'

import { useEffect, useMemo, useState } from 'react'
import { useConfirm } from '@elira/components/shared/confirm-modal'
import { ChannelDropdown } from '@/components/settings/AnDropdowns'
import { fetchBundle } from '@/lib/bundle-client'
import { isDiscordCategoryChannel, isDiscordTextChannel } from '@/lib/guild/channel-type'
import type { GuildChannel } from '@/components/settings/types'

interface LoggingChannel {
  channel_id: string
  events: string[]
}

interface Settings {
  channels: LoggingChannel[]
  ignored: string[]
}

interface ResolvedUser {
  user_id: string
  username: string
  display_name?: string | null
  avatar: string | null
}

const SNOWFLAKE_RE = /^\d{17,20}$/

const EVENT_TYPES = [
  'message',
  'member',
  'role',
  'channel',
  'invite',
  'moderation',
  'voice',
  'emoji',
  'sticker',
] as const

const EVENT_LABELS: Record<string, string> = {
  message: 'Message',
  member: 'Member',
  role: 'Role',
  channel: 'Channel',
  invite: 'Invite',
  moderation: 'Moderation',
  voice: 'Voice',
  emoji: 'Emoji',
  sticker: 'Sticker',
}

const EVENT_DESCRIPTIONS: Record<string, string> = {
  message: 'Message edits, deletions, and bulk deletes.',
  member: 'Member joins, leaves, and profile updates.',
  role: 'Role creation, deletion, and permission changes.',
  channel: 'Channel creation, deletion, and updates.',
  invite: 'Invite creation and deletion.',
  moderation: 'Bans, kicks, mutes, and warnings.',
  voice: 'Voice channel joins, leaves, and moves.',
  emoji: 'Emoji creation, deletion, and updates.',
  sticker: 'Sticker creation, deletion, and updates.',
}

const EVENT_ICONS: Record<string, React.ReactNode> = {
  message: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  member: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  ),
  role: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  channel: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="9" x2="20" y2="9" /><line x1="4" y1="15" x2="20" y2="15" /><line x1="10" y1="3" x2="8" y2="21" /><line x1="16" y1="3" x2="14" y2="21" />
    </svg>
  ),
  invite: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  ),
  moderation: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
    </svg>
  ),
  voice: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    </svg>
  ),
  emoji: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
  ),
  sticker: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15.5 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3Z" /><path d="M14 3v4a2 2 0 0 0 2 2h4" />
    </svg>
  ),
}

export default function LoggingSettings({ guildId }: { guildId: string }) {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [guildChannels, setGuildChannels] = useState<GuildChannel[]>([])
  const [guildCategories, setGuildCategories] = useState<GuildChannel[]>([])
  const [allChannels, setAllChannels] = useState<GuildChannel[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ignoreSaving, setIgnoreSaving] = useState<string | null>(null)
  const [userProfiles, setUserProfiles] = useState<Record<string, ResolvedUser>>({})
  const [profilesLoading, setProfilesLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchBundle(guildId, ['logging', 'channels'])
      .then((bundle) => {
        if (cancelled) return
        if (bundle.logging) setSettings(bundle.logging as Settings)
        const all = Array.isArray(bundle.channels)
          ? (bundle.channels as GuildChannel[])
          : []
        setAllChannels(all)
        setGuildChannels(all.filter((c) => isDiscordTextChannel(c)))
        setGuildCategories(all.filter((c) => isDiscordCategoryChannel(c)))
      })
      .catch(() => {
        if (cancelled) return
        setError('Failed to load logging settings')
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [guildId])

  const channelById = useMemo(() => {
    const m = new Map<string, GuildChannel>()
    for (const c of allChannels) m.set(String(c.id), c)
    return m
  }, [allChannels])

  const memberIgnoredIdsKey = useMemo(() => {
    if (!settings) return ''
    return settings.ignored
      .filter((id) => !channelById.has(id))
      .sort()
      .join(',')
  }, [settings, channelById])

  useEffect(() => {
    if (!memberIgnoredIdsKey) {
      setUserProfiles({})
      return
    }
    const ids = memberIgnoredIdsKey.split(',')
    let cancelled = false
    setProfilesLoading(true)
    fetch(`/api/guilds/${guildId}/logging/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
      .then(async (r) => {
        const data = await r.json()
        if (!r.ok) return
        if (!cancelled && data.users && typeof data.users === 'object') {
          const incoming = data.users as Record<string, ResolvedUser>
          const pruned: Record<string, ResolvedUser> = {}
          for (const id of ids) {
            if (incoming[id]) pruned[id] = incoming[id]
          }
          setUserProfiles(pruned)
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setProfilesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [guildId, memberIgnoredIdsKey])

  const eventChannelMap: Record<string, string | null> = {}
  if (settings) {
    for (const event of EVENT_TYPES) {
      const match = settings.channels.find((ch) =>
        ch.events.some((e) => e.toLowerCase() === event)
      )
      eventChannelMap[event] = match ? match.channel_id : null
    }
  }

  const setEventChannel = async (event: string, channelId: string | null) => {
    setSaving(event)
    setError(null)
    try {
      const res = await fetch(`/api/guilds/${guildId}/logging`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, channel_id: channelId }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to save')
        return
      }
      setSettings(await res.json())
    } catch {
      setError('Failed to save')
    } finally {
      setSaving(null)
    }
  }

  const addIgnored = async (targetId: string) => {
    if (!SNOWFLAKE_RE.test(targetId)) {
      setError('Use a 17–20 digit Discord ID.')
      return
    }
    if (settings?.ignored.includes(targetId)) return
    setIgnoreSaving(targetId)
    setError(null)
    try {
      const res = await fetch(`/api/guilds/${guildId}/logging`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_ignored', target_id: targetId }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to save')
        return
      }
      setSettings(await res.json())
    } catch {
      setError('Failed to save')
    } finally {
      setIgnoreSaving(null)
    }
  }

  const removeIgnored = async (targetId: string) => {
    setIgnoreSaving(targetId)
    setError(null)
    try {
      const res = await fetch(`/api/guilds/${guildId}/logging`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove_ignored', target_id: targetId }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to save')
        return
      }
      setSettings(await res.json())
    } catch {
      setError('Failed to save')
    } finally {
      setIgnoreSaving(null)
    }
  }

  if (loading) {
    return <div className="settings-loading">Loading...</div>
  }

  if (!settings) {
    return <div className="settings-error">Failed to load settings</div>
  }

  const enabledCount = EVENT_TYPES.filter((e) => eventChannelMap[e]).length

  return (
    <div className="logging-settings">
      {error && <p className="settings-error">{error}</p>}

      <div className="an-modules">
        {EVENT_TYPES.map((event, i) => (
          <EventCard
            key={event}
            event={event}
            index={i}
            channelId={eventChannelMap[event]}
            channels={guildChannels}
            categories={guildCategories}
            saving={saving === event}
            onSetChannel={(channelId) => setEventChannel(event, channelId)}
          />
        ))}
      </div>

      <IgnoreSection
        ignored={settings.ignored}
        channelById={channelById}
        allChannels={allChannels}
        categories={guildCategories}
        userProfiles={userProfiles}
        profilesLoading={profilesLoading}
        savingId={ignoreSaving}
        onAdd={addIgnored}
        onRemove={removeIgnored}
      />
    </div>
  )
}

function EventCard({
  event,
  index,
  channelId,
  channels,
  categories,
  saving,
  onSetChannel,
}: {
  event: string
  index: number
  channelId: string | null
  channels: GuildChannel[]
  categories: GuildChannel[]
  saving: boolean
  onSetChannel: (channelId: string | null) => void
}) {
  const enabled = !!channelId

  const handleToggle = () => {
    if (enabled) {
      onSetChannel(null)
    }
  }

  return (
    <div
      className={`an-module${enabled ? ' enabled' : ''}`}
      style={{ animationDelay: `${0.03 * (index + 1)}s` }}
    >
      <div className="an-module-header">
        <span className="an-module-name">
          <span className="logging-event-icon">{EVENT_ICONS[event]}</span>
          {EVENT_LABELS[event]}
        </span>
        <button
          className={`an-toggle ${enabled ? 'on' : ''}`}
          onClick={handleToggle}
          disabled={saving || !enabled}
        >
          <span className="an-toggle-knob" />
        </button>
      </div>
      <span className="an-module-desc">{EVENT_DESCRIPTIONS[event]}</span>
      <div className="an-module-body">
        <div className="an-edit-field">
          <label>Channel</label>
          <ChannelDropdown
            channels={channels}
            categories={categories}
            value={channelId || ''}
            onChange={(id) => onSetChannel(id || null)}
            placeholder="Select a channel"
            saving={saving}
          />
        </div>
      </div>
    </div>
  )
}

function IgnoreSection({
  ignored,
  channelById,
  allChannels,
  categories,
  userProfiles,
  profilesLoading,
  savingId,
  onAdd,
  onRemove,
}: {
  ignored: string[]
  channelById: Map<string, GuildChannel>
  allChannels: GuildChannel[]
  categories: GuildChannel[]
  userProfiles: Record<string, ResolvedUser>
  profilesLoading: boolean
  savingId: string | null
  onAdd: (id: string) => void
  onRemove: (id: string) => void
}) {
  const { confirm, modal: confirmModal } = useConfirm()
  const [manualId, setManualId] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  const ignoredSet = useMemo(() => new Set(ignored), [ignored])

  const requestRemove = async (
    id: string,
    opts: { kind: 'channel'; name: string } | { kind: 'user'; label: string }
  ) => {
    const ok = await confirm({
      title: opts.kind === 'channel' ? 'Stop ignoring channel?' : 'Stop ignoring user?',
      description:
        opts.kind === 'channel'
          ? `#${opts.name} will start generating logs again.`
          : `${opts.label} will start generating logs again.`,
      confirmLabel: 'Remove',
      cancelLabel: 'Cancel',
      destructive: true,
    })
    if (!ok) return
    onRemove(id)
  }

  const availableChannels = useMemo(
    () => allChannels.filter((c) => !ignoredSet.has(String(c.id))),
    [allChannels, ignoredSet]
  )

  const submitManual = () => {
    const t = manualId.trim()
    setLocalError(null)
    if (!t) return
    if (!SNOWFLAKE_RE.test(t)) {
      setLocalError('Use a 17–20 digit Discord ID.')
      return
    }
    if (ignoredSet.has(t)) {
      setLocalError('Already ignored.')
      return
    }
    onAdd(t)
    setManualId('')
  }

  return (
    <>
    <section className="an-access logging-ignore-section" aria-labelledby="logging-ignore-heading">
      <header className="server-content-header">
        <h2 id="logging-ignore-heading" className="server-content-title">
          Ignored targets
        </h2>
        <p className="server-content-desc">
          Members and channels listed here won&apos;t trigger any logs.
        </p>
      </header>
      <div className="an-access-panel">
        <div className="logging-ignore-controls">
          <div className="logging-ignore-control">
            <label className="logging-ignore-label">Channel</label>
            <ChannelDropdown
              channels={availableChannels}
              categories={categories}
              value=""
              onChange={(id) => {
                if (id) onAdd(id)
              }}
              placeholder="Ignore a channel..."
              saving={false}
            />
          </div>
          <div className="logging-ignore-control">
            <label className="logging-ignore-label">User ID</label>
            <div className="an-access-add">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="Member ID"
                value={manualId}
                onChange={(e) => {
                  setLocalError(null)
                  setManualId(e.target.value.replace(/\D/g, '').slice(0, 20))
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    submitManual()
                  }
                }}
                className="settings-input an-access-input"
              />
              <button
                type="button"
                className="system-messages-icon-btn system-messages-plus-btn"
                onClick={submitManual}
                disabled={!manualId.trim()}
                aria-label="Add user to ignore list"
                title="Ignore this user"
              >
                +
              </button>
            </div>
          </div>
        </div>
        {localError && <p className="an-access-local-error">{localError}</p>}
        <ul className="an-access-chips" aria-label="Ignored targets">
          {ignored.length === 0 ? (
            <li className="an-access-empty">Nothing ignored yet</li>
          ) : (
            ignored.map((id) => {
              const channel = channelById.get(id)
              const user = userProfiles[id]
              const removing = savingId === id
              if (channel) {
                return (
                  <li key={id} className="an-access-chip">
                    <div className="an-access-chip-main">
                      <div
                        className="an-access-chip-avatar an-access-chip-avatar-placeholder"
                        aria-hidden
                      >
                        #
                      </div>
                      <div className="an-access-chip-text">
                        <span className="an-access-chip-name">#{channel.name}</span>
                        <span className="an-access-chip-id">Channel · {id}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="system-messages-icon-btn system-messages-minus-btn"
                      aria-label={`Stop ignoring #${channel.name}`}
                      title="Remove"
                      disabled={removing}
                      onClick={() =>
                        void requestRemove(id, { kind: 'channel', name: channel.name })
                      }
                    >
                      -
                    </button>
                  </li>
                )
              }

              const handle = user?.username?.trim() || ''
              const display = user?.display_name?.trim() || ''
              const primary = display || handle || (profilesLoading ? 'Loading…' : 'Unknown user')
              const secondary = handle ? `@${handle} · ${id}` : `Member · ${id}`
              return (
                <li key={id} className="an-access-chip">
                  <div className="an-access-chip-main">
                    {user?.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={user.avatar} alt="" className="an-access-chip-avatar" />
                    ) : (
                      <div
                        className="an-access-chip-avatar an-access-chip-avatar-placeholder"
                        aria-hidden
                      >
                        {(primary[0] || '?').toUpperCase()}
                      </div>
                    )}
                    <div className="an-access-chip-text">
                      <span className="an-access-chip-name">{primary}</span>
                      <span className="an-access-chip-id">{secondary}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="system-messages-icon-btn system-messages-minus-btn"
                    aria-label={`Stop ignoring ${primary}`}
                    title="Remove"
                    disabled={removing}
                    onClick={() => void requestRemove(id, { kind: 'user', label: primary })}
                  >
                    -
                  </button>
                </li>
              )
            })
          )}
        </ul>
      </div>
    </section>
    {confirmModal}
    </>
  )
}
