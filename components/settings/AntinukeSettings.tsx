'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useConfirm } from '@elira/components/shared/confirm-modal'
import { Dropdown } from '@/components/settings/AnDropdowns'
interface ResolvedDiscordUser {
  user_id: string
  username: string
  display_name?: string | null
  avatar: string | null
}

interface Module {
  threshold: number
  duration: number
  punishment: 'ban' | 'kick' | 'strip'
}

interface Settings {
  bot: boolean
  ban: Module | null
  kick: Module | null
  role: Module | null
  channel: Module | null
  webhook: Module | null
  emoji: Module | null
  whitelist: string[]
  trusted_admins: string[]
}

const MODULE_NAMES = ['ban', 'kick', 'role', 'channel', 'webhook', 'emoji'] as const

const MODULE_LABELS: Record<string, string> = {
  ban: 'Ban Protection',
  kick: 'Kick Protection',
  role: 'Role Protection',
  channel: 'Channel Protection',
  webhook: 'Webhook Protection',
  emoji: 'Emoji Protection',
}

const MODULE_DESCRIPTIONS: Record<string, string> = {
  ban: 'Triggers when a user bans too many members.',
  kick: 'Triggers when a user kicks too many members.',
  role: 'Triggers when a user deletes or modifies too many roles.',
  channel: 'Triggers when a user deletes or modifies too many channels.',
  webhook: 'Triggers when a user creates too many webhooks.',
  emoji: 'Triggers when a user deletes too many emojis.',
}

function defaultModule(): Module {
  return { threshold: 5, duration: 60, punishment: 'ban' }
}

const SNOWFLAKE_RE = /^\d{17,20}$/

type UserListField = 'whitelist' | 'trusted_admins'

const USER_LIST_OPTIONS: { value: UserListField; label: string }[] = [
  { value: 'trusted_admins', label: 'Trusted' },
  { value: 'whitelist', label: 'Whitelist' },
]

const USER_LIST_META: Record<UserListField, { title: string; description: string }> = {
  trusted_admins: {
    title: 'Trusted admins',
    description:
      'May configure antinuke from Discord and this dashboard. Treated like the server owner for exemptions.',
  },
  whitelist: {
    title: 'Whitelist',
    description: 'Exempt from antinuke punishment triggers. Cannot manage antinuke settings.',
  },
}

export default function AntinukeSettings({
  guildId,
  ownerId,
  currentUserId,
}: {
  guildId: string
  ownerId: string
  currentUserId: string
}) {
  const router = useRouter()
  const exitIfForbidden = useCallback(
    (status: number) => {
      if (status === 403) {
        router.replace(`/dashboard/${guildId}/general`)
        return true
      }
      return false
    },
    [guildId, router]
  )

  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [listSaving, setListSaving] = useState<'whitelist' | 'trusted_admins' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [userProfiles, setUserProfiles] = useState<
    Record<string, ResolvedDiscordUser>
  >({})
  const [profilesLoading, setProfilesLoading] = useState(false)

  useEffect(() => {
    fetch(`/api/guilds/${guildId}/antinuke`)
      .then(async (r) => {
        if (exitIfForbidden(r.status)) return
        const data = await r.json()
        if (!r.ok) {
          setError(data.error || 'Failed to load antinuke settings')
          return
        }
        setSettings(data as Settings)
      })
      .catch(() => setError('Failed to load antinuke settings'))
      .finally(() => setLoading(false))
  }, [guildId, exitIfForbidden])

  const profileIdsKey = useMemo(() => {
    if (!settings) return ''
    const ids = [
      ...new Set([ownerId, ...settings.trusted_admins, ...settings.whitelist]),
    ].sort()
    return ids.join(',')
  }, [settings, ownerId])

  useEffect(() => {
    if (!settings) return
    const ids = [
      ...new Set([ownerId, ...settings.trusted_admins, ...settings.whitelist]),
    ]
    if (ids.length === 0) {
      setUserProfiles({})
      return
    }

    let cancelled = false
    setProfilesLoading(true)
    fetch(`/api/guilds/${guildId}/antinuke/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
      .then(async (r) => {
        if (exitIfForbidden(r.status)) return
        const data = await r.json()
        if (!r.ok) return
        if (!cancelled && data.users && typeof data.users === 'object') {
          const incoming = data.users as Record<string, ResolvedDiscordUser>
          const pruned: Record<string, ResolvedDiscordUser> = {}
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
  }, [guildId, ownerId, profileIdsKey, exitIfForbidden])

  const toggleModule = async (name: string) => {
    if (!settings) return
    const current = settings[name as keyof Settings] as Module | null
    const next = current ? null : defaultModule()

    setSaving(name)
    setError(null)
    try {
      const res = await fetch(`/api/guilds/${guildId}/antinuke`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module: name, config: next }),
      })
      if (exitIfForbidden(res.status)) return
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

  const updateModule = async (name: string, config: Module) => {
    setSaving(name)
    setError(null)
    try {
      const res = await fetch(`/api/guilds/${guildId}/antinuke`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module: name, config }),
      })
      if (exitIfForbidden(res.status)) return
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

  const toggleBot = async () => {
    if (!settings) return
    setSaving('bot')
    setError(null)
    try {
      const res = await fetch(`/api/guilds/${guildId}/antinuke`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bot: !settings.bot }),
      })
      if (exitIfForbidden(res.status)) return
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

  const patchUserList = async (
    field: 'whitelist' | 'trusted_admins',
    next: string[]
  ) => {
    setListSaving(field)
    setError(null)
    try {
      const res = await fetch(`/api/guilds/${guildId}/antinuke`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: next }),
      })
      if (exitIfForbidden(res.status)) return
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to save')
        return
      }
      setSettings(await res.json())
    } catch {
      setError('Failed to save')
    } finally {
      setListSaving(null)
    }
  }

  if (loading) {
    return <div className="settings-loading">Loading...</div>
  }

  if (!settings) {
    return <div className="settings-error">Failed to load settings</div>
  }

  const renderModuleCard = (name: (typeof MODULE_NAMES)[number]) => {
    const mod = settings[name] as Module | null
    return (
      <ModuleCard
        key={name}
        name={name}
        label={MODULE_LABELS[name]}
        description={MODULE_DESCRIPTIONS[name]}
        config={mod}
        saving={saving === name}
        onToggle={() => toggleModule(name)}
        onUpdate={(config) => updateModule(name, config)}
      />
    )
  }

  const antiBotCard = (
    <div className={`an-module ${settings.bot ? 'enabled' : ''}`}>
      <div className="an-module-header">
        <span className="an-module-name">Anti-Bot</span>
        <button
          className={`an-toggle ${settings.bot ? 'on' : ''}`}
          onClick={toggleBot}
          disabled={saving === 'bot'}
        >
          <span className="an-toggle-knob" />
        </button>
      </div>
      <span className="an-module-desc">Prevent unauthorized bots from being added.</span>
    </div>
  )

  return (
    <div className="antinuke-settings">
      {error && <p className="settings-error">{error}</p>}

      <div className="an-modules">
        {MODULE_NAMES.map(renderModuleCard)}
        {antiBotCard}
      </div>

      <section className="an-access" aria-labelledby="an-access-heading">
        <header className="server-content-header">
          <h2 id="an-access-heading" className="server-content-title">
            Trusted &amp; whitelisted users
          </h2>
          <p className="server-content-desc">
            Add users by ID and choose whether they are trusted or whitelisted.
          </p>
        </header>
        <AntinukeUserListsPanel
          ownerId={ownerId}
          currentUserId={currentUserId}
          trustedIds={settings.trusted_admins}
          whitelistIds={settings.whitelist}
          userProfiles={userProfiles}
          profilesLoading={profilesLoading}
          disabled={listSaving !== null}
          savingField={listSaving}
          onTrustedChange={(next) => {
            void patchUserList('trusted_admins', next)
          }}
          onWhitelistChange={(next) => {
            void patchUserList('whitelist', next)
          }}
        />
      </section>
    </div>
  )
}

function userChipLabels(
  p: ResolvedDiscordUser | undefined,
  id: string,
  profilesLoading: boolean
): { primary: string; secondary: string } {
  const handle = p?.username?.trim() || ''
  const display = p?.display_name?.trim() || ''
  const primary = display || handle || (profilesLoading ? 'Loading…' : 'Unknown user')
  const secondary = handle ? `@${handle} · ${id}` : `Member · ${id}`
  return { primary, secondary }
}

function ownerListDisplayIds(ids: string[], ownerId: string): string[] {
  const rest = ids.filter((id) => id !== ownerId)
  return ids.includes(ownerId) ? [ownerId, ...rest] : [ownerId, ...ids]
}

function AntinukeUserListsPanel({
  ownerId,
  currentUserId,
  trustedIds,
  whitelistIds,
  userProfiles,
  profilesLoading,
  disabled,
  savingField,
  onTrustedChange,
  onWhitelistChange,
}: {
  ownerId: string
  currentUserId: string
  trustedIds: string[]
  whitelistIds: string[]
  userProfiles: Record<string, ResolvedDiscordUser>
  profilesLoading: boolean
  disabled: boolean
  savingField: UserListField | null
  onTrustedChange: (next: string[]) => void
  onWhitelistChange: (next: string[]) => void
}) {
  const { confirm, modal: confirmModal } = useConfirm()
  const [addTarget, setAddTarget] = useState<UserListField>('trusted_admins')
  const [input, setInput] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  const lists: Record<UserListField, { ids: string[]; onChange: (next: string[]) => void }> = {
    trusted_admins: { ids: trustedIds, onChange: onTrustedChange },
    whitelist: { ids: whitelistIds, onChange: onWhitelistChange },
  }

  const add = async () => {
    const t = input.trim()
    setLocalError(null)
    if (!t) return
    if (!SNOWFLAKE_RE.test(t)) {
      setLocalError('Use a 17–20 digit Discord user ID.')
      return
    }
    const { ids, onChange } = lists[addTarget]
    if (t === ownerId) {
      setLocalError(
        addTarget === 'trusted_admins'
          ? 'The server owner is already a trusted admin.'
          : 'The server owner is already on the whitelist.'
      )
      return
    }
    if (ids.includes(t)) {
      setLocalError(`Already in ${USER_LIST_META[addTarget].title.toLowerCase()}.`)
      return
    }
    if (addTarget === 'trusted_admins') {
      const ok = await confirm({
        title: 'Add trusted admin?',
        description:
          'Trusted admins can configure antinuke from Discord and this dashboard, and are treated like the server owner for exemptions. Only add people you fully trust.',
        confirmLabel: 'Add trusted',
        cancelLabel: 'Cancel',
        destructive: true,
      })
      if (!ok) return
    }
    onChange([...ids, t])
    setInput('')
  }

  const removeUser = async (field: UserListField, id: string, label: string) => {
    const meta = USER_LIST_META[field]
    const ok = await confirm({
      title: `Remove from ${meta.title}?`,
      description:
        field === 'trusted_admins'
          ? `${label} will no longer be a trusted admin and may lose access to configure antinuke.`
          : `${label} will no longer be exempt from antinuke punishment triggers.`,
      confirmLabel: 'Remove',
      cancelLabel: 'Cancel',
      destructive: true,
    })
    if (!ok) return
    const { ids, onChange } = lists[field]
    onChange(ids.filter((x) => x !== id))
  }

  return (
    <div className="an-access-panel an-access-panel--unified an-module">
      <div className="an-access-unified-add">
        <label className="an-access-unified-label" htmlFor="antinuke-add-list-type">
          List type
        </label>
        <div className="an-access-unified-add-row">
          <div className="an-access-unified-type" id="antinuke-add-list-type">
            <Dropdown
              value={addTarget}
              options={USER_LIST_OPTIONS}
              onChange={(v) => {
                setLocalError(null)
                setAddTarget(v as UserListField)
              }}
              disabled={disabled}
            />
          </div>
          <div className="an-access-add an-access-unified-id">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="User ID"
              value={input}
              disabled={disabled}
              onChange={(e) => {
                setLocalError(null)
                setInput(e.target.value.replace(/\D/g, '').slice(0, 20))
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void add()
                }
              }}
              className="settings-input an-access-input"
            />
            <button
              type="button"
              className="system-messages-icon-btn system-messages-plus-btn"
              onClick={() => void add()}
              disabled={disabled || !input.trim()}
              aria-label={`Add to ${USER_LIST_META[addTarget].title}`}
              title={`Add to ${USER_LIST_META[addTarget].title}`}
            >
              +
            </button>
          </div>
        </div>
        <p className="an-access-unified-type-desc">{USER_LIST_META[addTarget].description}</p>
        {localError && <p className="an-access-local-error">{localError}</p>}
      </div>

      <div className="an-access-grid">
      {(['trusted_admins', 'whitelist'] as const).map((field) => {
        const meta = USER_LIST_META[field]
        const { ids, onChange } = lists[field]
        const displayIds = ownerListDisplayIds(ids, ownerId)
        return (
          <section
            key={field}
            className="an-access-list-section"
            aria-labelledby={`an-access-list-${field}`}
          >
            <div className="an-access-list-section-header">
              <h3 id={`an-access-list-${field}`} className="an-access-list-section-title">
                {meta.title}
              </h3>
              <span className="an-access-card-count">{displayIds.length}</span>
            </div>
            <p className="an-module-desc an-access-list-section-desc">{meta.description}</p>
            <ul className="an-access-chips" aria-label={meta.title}>
              {displayIds.length === 0 ? (
                <li className="an-access-empty">No users yet</li>
              ) : (
                displayIds.map((id) => {
                  const p = userProfiles[id]
                  const { primary, secondary } = userChipLabels(p, id, profilesLoading)
                  const isOwner = id === ownerId
                  const isSelf = id === currentUserId
                  return (
                    <li key={id} className="an-access-chip">
                      <div className="an-access-chip-main">
                        {p?.avatar ? (
                          <img
                            src={p.avatar}
                            alt=""
                            className="an-access-chip-avatar"
                          />
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
                      {isOwner ? (
                        <span
                          className="an-access-chip-owner-hint"
                          title={`Server owner cannot be removed from the ${meta.title.toLowerCase()}`}
                        >
                          Owner
                        </span>
                      ) : !isSelf ? (
                        <button
                          type="button"
                          className="system-messages-icon-btn system-messages-minus-btn"
                          aria-label={`Remove ${primary} from ${meta.title}`}
                          title="Remove"
                          disabled={disabled}
                          onClick={() => void removeUser(field, id, primary)}
                        >
                          -
                        </button>
                      ) : (
                        <span
                          className="an-access-chip-self-hint"
                          title="You cannot remove yourself from this list"
                        >
                          You
                        </span>
                      )}
                    </li>
                  )
                })
              )}
            </ul>
            {savingField === field && <p className="settings-hint">Saving…</p>}
          </section>
        )
      })}
      </div>
      {confirmModal}
    </div>
  )
}

function ModuleCard({
  name,
  label,
  description,
  config,
  saving,
  onToggle,
  onUpdate,
}: {
  name: string
  label: string
  description: string
  config: Module | null
  saving: boolean
  onToggle: () => void
  onUpdate: (config: Module) => void
}) {
  const [threshold, setThreshold] = useState(config?.threshold ?? 5)
  const [duration, setDuration] = useState(config?.duration ?? 60)
  const [punishment, setPunishment] = useState<Module['punishment']>(config?.punishment ?? 'ban')

  useEffect(() => {
    if (config) {
      setThreshold(config.threshold)
      setDuration(config.duration)
      setPunishment(config.punishment)
    }
  }, [config])

  const dirty = config && (threshold !== config.threshold || duration !== config.duration || punishment !== config.punishment)

  const handleSave = () => {
    onUpdate({ threshold, duration, punishment })
  }

  return (
    <div className={`an-module ${config ? 'enabled' : ''}`}>
      <div className="an-module-header">
        <span className="an-module-name">{label}</span>
        <button
          className={`an-toggle ${config ? 'on' : ''}`}
          onClick={onToggle}
          disabled={saving}
        >
          <span className="an-toggle-knob" />
        </button>
      </div>
      <span className="an-module-desc">{description}</span>
      {config && (
        <div className="an-module-body">
          <div className="an-edit-field">
            <label>Threshold</label>
            <div className="settings-input-row">
              <input
                type="number"
                min={1}
                max={100}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="settings-input"
              />
            </div>
          </div>
          <div className="an-edit-field">
            <label>Duration (seconds)</label>
            <div className="settings-input-row">
              <input
                type="number"
                min={1}
                max={86400}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="settings-input"
              />
            </div>
          </div>
          <div className="an-edit-field">
            <label>Punishment</label>
            <Dropdown
              value={punishment}
              options={[
                { value: 'ban', label: 'Ban' },
                { value: 'kick', label: 'Kick' },
                { value: 'strip', label: 'Strip Roles' },
              ]}
              onChange={(v) => setPunishment(v as Module['punishment'])}
            />
          </div>
          <div className="settings-input-row" style={{ marginTop: 4 }}>
            <button className="settings-save-btn" onClick={handleSave} disabled={saving || !dirty}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
          {dirty && <p className="settings-hint">You have unsaved changes</p>}
        </div>
      )}
    </div>
  )
}
