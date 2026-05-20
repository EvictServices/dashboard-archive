'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChannelDropdown, Dropdown, RoleDropdown } from '@/components/settings/AnDropdowns'
import { fetchBundle } from '@/lib/bundle-client'
import { isDiscordCategoryChannel, isDiscordTextChannel } from '@/lib/guild/channel-type'
import { colorHex, type GuildChannel, type GuildRole } from '@/components/settings/types'
import { OverflowChipDropdown } from '@/components/settings/OverflowChipDropdown'
import { CommandModulePicker } from '@/components/settings/CommandModulePicker'
import type { CatalogCommand } from '@/lib/commands/catalog'
import { canDisableCommand } from '@/lib/settings/command-mgmt'
import PrefixSettings from './PrefixSettings'

interface DisabledGroup {
  command: string
  channel_ids: string[]
}

interface RestrictionGroup {
  command: string
  role_ids: string[]
}

const MAX_VISIBLE_CHANNEL_CHIPS = 5
const MAX_VISIBLE_ROLE_CHIPS = 5

type AddRuleMode = 'disable' | 'ignore' | 'restrict'

function isEveryoneRole(r: GuildRole): boolean {
  return (r as GuildRole & { is_default?: boolean }).is_default === true
}

export default function DisabledCommandsSettings({ guildId }: { guildId: string }) {
  const [entries, setEntries] = useState<DisabledGroup[]>([])
  const [textChannels, setTextChannels] = useState<GuildChannel[]>([])
  const [allGuildChannels, setAllGuildChannels] = useState<GuildChannel[]>([])
  const [categories, setCategories] = useState<GuildChannel[]>([])
  const [guildRoles, setGuildRoles] = useState<GuildRole[]>([])
  const [ignoredTargetIds, setIgnoredTargetIds] = useState<string[]>([])
  const [restrictEntries, setRestrictEntries] = useState<RestrictionGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [accessError, setAccessError] = useState<string | null>(null)
  const [commandDraft, setCommandDraft] = useState('')
  const [pickerChannel, setPickerChannel] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [ignoreDraft, setIgnoreDraft] = useState('')
  const [ignorePickerChannel, setIgnorePickerChannel] = useState('')
  const [catalogCommands, setCatalogCommands] = useState<CatalogCommand[]>([])
  const [commandsLoading, setCommandsLoading] = useState(true)
  const [ignoreSaving, setIgnoreSaving] = useState(false)
  const [removingIgnore, setRemovingIgnore] = useState<string | null>(null)
  const [restrictCommandDraft, setRestrictCommandDraft] = useState('')
  const [restrictRolePicker, setRestrictRolePicker] = useState('')
  const [restrictSelectedRoleIds, setRestrictSelectedRoleIds] = useState<string[]>([])
  const [restrictSaving, setRestrictSaving] = useState(false)
  const [removingRestrict, setRemovingRestrict] = useState<string | null>(null)
  const [addRuleMode, setAddRuleMode] = useState<AddRuleMode>('disable')

  const channelById = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of allGuildChannels) {
      const id = String(c.id).trim()
      if (id) m.set(id, c.name)
    }
    return m
  }, [allGuildChannels])

  const channelLabel = (id: string) => channelById.get(String(id).trim()) ?? null

  const roleById = useMemo(() => {
    const m = new Map<string, GuildRole>()
    for (const r of guildRoles) m.set(r.id, r)
    return m
  }, [guildRoles])

  const roleLabel = (id: string) => roleById.get(String(id).trim())?.name ?? null

  const restrictAssignableRoles = useMemo(
    () => guildRoles.filter((r) => !isEveryoneRole(r) && !r.managed && !r.is_bot_managed),
    [guildRoles]
  )

  const disableableCommands = useMemo(
    () => catalogCommands.filter((c) => canDisableCommand(c.name)),
    [catalogCommands]
  )

  useEffect(() => {
    if (commandDraft && !canDisableCommand(commandDraft)) {
      setCommandDraft('')
    }
  }, [commandDraft, disableableCommands])

  const targetDisplayLabel = (targetId: string) => {
    const ch = channelLabel(targetId)
    if (ch) return `#${ch}`
    return `Member ${targetId.length > 12 ? `${targetId.slice(0, 8)}…` : targetId}`
  }

  const load = useCallback(async () => {
    setError(null)
    setAccessError(null)
    try {
      const [bundle, disabledRes, ignoreRes, restrictRes] = await Promise.all([
        fetchBundle(guildId, ['channels', 'roles']),
        fetch(`/api/guilds/${guildId}/disabled-commands`),
        fetch(`/api/guilds/${guildId}/command-ignore`),
        fetch(`/api/guilds/${guildId}/command-restrict`),
      ])
      const raw = (bundle.channels ?? []) as GuildChannel[]
      const text = raw.filter((c) => isDiscordTextChannel(c))
      const cats = raw.filter((c) => isDiscordCategoryChannel(c))
      setTextChannels(text)
      setCategories(cats)
      setAllGuildChannels(raw)
      setGuildRoles(Array.isArray(bundle.roles) ? (bundle.roles as GuildRole[]) : [])

      if (!disabledRes.ok) {
        const d = await disabledRes.json().catch(() => ({}))
        throw new Error(d.error || 'Failed to load disabled commands')
      }
      const data = (await disabledRes.json()) as { entries: DisabledGroup[] }
      setEntries(data.entries ?? [])

      const loadWarn: string[] = []
      if (ignoreRes.ok) {
        const ig = (await ignoreRes.json()) as { targetIds?: string[] }
        setIgnoredTargetIds(ig.targetIds ?? [])
      } else {
        setIgnoredTargetIds([])
        loadWarn.push('command ignore')
      }
      if (restrictRes.ok) {
        const rs = (await restrictRes.json()) as { entries?: RestrictionGroup[] }
        setRestrictEntries(rs.entries ?? [])
      } else {
        setRestrictEntries([])
        loadWarn.push('command restrict')
      }
      if (loadWarn.length > 0) {
        setAccessError(`Some lists could not be loaded (${loadWarn.join(', ')}).`)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [guildId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    let cancelled = false
    setCommandsLoading(true)
    fetch('/api/cluster/commands')
      .then(async (r) => {
        const data = await r.json().catch(() => ({}))
        if (cancelled) return
        setCatalogCommands(Array.isArray(data.commands) ? (data.commands as CatalogCommand[]) : [])
      })
      .catch(() => {
        if (!cancelled) setCatalogCommands([])
      })
      .finally(() => {
        if (!cancelled) setCommandsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const addPickerToSelection = () => {
    if (!pickerChannel) return
    setSelectedIds((prev) => (prev.includes(pickerChannel) ? prev : [...prev, pickerChannel]))
    setPickerChannel('')
  }

  const selectAllText = () => {
    setSelectedIds(textChannels.map((c) => c.id))
  }

  const clearSelection = () => {
    setSelectedIds([])
  }

  const submitDisable = async () => {
    const cmd = commandDraft.trim()
    if (!cmd || selectedIds.length === 0) {
      setError('Select a command and choose at least one channel.')
      return
    }
    if (!canDisableCommand(cmd)) {
      setError('The help command cannot be disabled.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/guilds/${guildId}/disabled-commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd, channelIds: selectedIds }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Save failed')
        return
      }
      setEntries(data.entries ?? [])
      setCommandDraft('')
      setSelectedIds([])
    } catch {
      setError('Save failed')
    } finally {
      setSaving(false)
    }
  }

  const removeChannels = async (
    command: string,
    channelIds: string[],
    mode: 'all' | 'one' | 'purge-unknown'
  ) => {
    const key =
      mode === 'all'
        ? `${command}::all`
        : mode === 'purge-unknown'
          ? `${command}::purge-unknown`
          : `${command}::${channelIds[0]}`
    setRemoving(key)
    setError(null)
    try {
      const res = await fetch(`/api/guilds/${guildId}/disabled-commands`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, channelIds }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Remove failed')
        return
      }
      setEntries(data.entries ?? [])
    } catch {
      setError('Remove failed')
    } finally {
      setRemoving(null)
    }
  }

  const submitIgnore = async (targetIdOverride?: string) => {
    const id = (targetIdOverride ?? ignoreDraft).replace(/\D/g, '')
    if (id.length < 17) {
      setAccessError('Enter a 17–20 digit channel or user ID.')
      return
    }
    setIgnoreSaving(true)
    setAccessError(null)
    try {
      const res = await fetch(`/api/guilds/${guildId}/command-ignore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId: id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setAccessError(typeof data.error === 'string' ? data.error : 'Could not add ignore')
        return
      }
      setIgnoredTargetIds((data as { targetIds?: string[] }).targetIds ?? [])
      setIgnoreDraft('')
    } catch {
      setAccessError('Could not add ignore')
    } finally {
      setIgnoreSaving(false)
    }
  }

  const removeIgnoreTarget = async (targetId: string) => {
    setRemovingIgnore(targetId)
    setAccessError(null)
    try {
      const res = await fetch(`/api/guilds/${guildId}/command-ignore`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setAccessError(typeof data.error === 'string' ? data.error : 'Remove failed')
        return
      }
      setIgnoredTargetIds((data as { targetIds?: string[] }).targetIds ?? [])
    } catch {
      setAccessError('Remove failed')
    } finally {
      setRemovingIgnore(null)
    }
  }

  const addRestrictRoleToSelection = () => {
    if (!restrictRolePicker) return
    setRestrictSelectedRoleIds((prev) =>
      prev.includes(restrictRolePicker) ? prev : [...prev, restrictRolePicker]
    )
    setRestrictRolePicker('')
  }

  const submitRestrict = async () => {
    const cmd = restrictCommandDraft.trim()
    if (!cmd || restrictSelectedRoleIds.length === 0) {
      setAccessError('Select a command and at least one role for restrictions.')
      return
    }
    setRestrictSaving(true)
    setAccessError(null)
    try {
      const res = await fetch(`/api/guilds/${guildId}/command-restrict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd, roleIds: restrictSelectedRoleIds }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setAccessError(typeof data.error === 'string' ? data.error : 'Save failed')
        return
      }
      setRestrictEntries((data as { entries?: RestrictionGroup[] }).entries ?? [])
      setRestrictCommandDraft('')
      setRestrictSelectedRoleIds([])
    } catch {
      setAccessError('Save failed')
    } finally {
      setRestrictSaving(false)
    }
  }

  const removeRestrict = async (command: string, roleIds: string[], mode: 'all' | 'one') => {
    const key =
      mode === 'all' ? `${command}::rst-all` : `${command}::rst::${roleIds[0]}`
    setRemovingRestrict(key)
    setAccessError(null)
    try {
      const res = await fetch(`/api/guilds/${guildId}/command-restrict`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, roleIds }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setAccessError(typeof data.error === 'string' ? data.error : 'Remove failed')
        return
      }
      setRestrictEntries((data as { entries?: RestrictionGroup[] }).entries ?? [])
    } catch {
      setAccessError('Remove failed')
    } finally {
      setRemovingRestrict(null)
    }
  }

  const selectionVisibleIds = selectedIds.slice(0, MAX_VISIBLE_CHANNEL_CHIPS)
  const selectionExtraIds = selectedIds.slice(MAX_VISIBLE_CHANNEL_CHIPS)
  const selectionExtraCount = selectionExtraIds.length

  const addModeDesc =
    addRuleMode === 'disable'
      ? 'Pick a command from the list, add channels, then save.'
      : addRuleMode === 'ignore'
        ? 'Pick a channel by category, or add a member by Discord ID below.'
        : 'Pick a command from the list, add roles, then save. Only members with those roles may use the command (unless they have Administrator).'

  const addRulePanel = (
    <section className="general-settings-pane general-settings-pane--add-rule">
      <div className="general-settings-add-rule-header">
        <span className="settings-label" id={`cmd-mgmt-mode-label-${guildId}`}>
          Add
        </span>
        <div className="general-settings-add-rule-mode">
          <Dropdown
            value={addRuleMode}
            options={[
              { value: 'disable', label: 'Disable command in channels' },
              { value: 'ignore', label: 'Ignore channel or member' },
              { value: 'restrict', label: 'Restrict command to roles' },
            ]}
            onChange={(v) => {
              if (v === 'disable' || v === 'ignore' || v === 'restrict') {
                setAddRuleMode(v)
                setError(null)
                setAccessError(null)
              }
            }}
            disabled={loading}
            placeholder="Select type…"
            aria-labelledby={`cmd-mgmt-mode-label-${guildId}`}
          />
        </div>
      </div>
      <p className="settings-desc general-settings-pane-desc">{addModeDesc}</p>

      {addRuleMode === 'disable' && (
        <div className="disabled-commands-add-controls">
          <span
            className="settings-label cmd-module-picker-label"
            id={`cmd-mgmt-disable-cmd-${guildId}`}
          >
            Command
          </span>
          <CommandModulePicker
            commands={disableableCommands}
            value={commandDraft}
            onChange={(name) => {
              setCommandDraft(name)
              setError(null)
            }}
            disabled={saving || loading}
            loading={commandsLoading}
            aria-labelledby={`cmd-mgmt-disable-cmd-${guildId}`}
          />
          <div className="disabled-commands-channel-row">
            <ChannelDropdown
              channels={textChannels}
              categories={categories}
              value={pickerChannel}
              onChange={setPickerChannel}
              placeholder="Pick a text channel"
              saving={saving || loading}
            />
          </div>
          <div className="disabled-commands-add-actions">
            <button
              type="button"
              className="settings-save-btn"
              onClick={addPickerToSelection}
              disabled={saving || loading || !pickerChannel}
            >
              Add channel
            </button>
            <button
              type="button"
              className="settings-save-btn"
              onClick={selectAllText}
              disabled={saving || loading || textChannels.length === 0}
            >
              All text channels
            </button>
            <button
              type="button"
              className="settings-save-btn welcome-message-remove-btn"
              onClick={clearSelection}
              disabled={saving || loading || selectedIds.length === 0}
            >
              Clear selection
            </button>
          </div>
          {selectedIds.length > 0 && (
            <div className="disabled-commands-chips disabled-commands-chips--selection">
              {selectionVisibleIds.map((cid) => {
                const name = channelLabel(cid)
                if (!name) return null
                return (
                  <span key={cid} className="disabled-commands-chip">
                    #{name}
                    <button
                      type="button"
                      className="disabled-commands-chip-remove"
                      aria-label="Remove from selection"
                      disabled={saving}
                      onClick={() => setSelectedIds((prev) => prev.filter((id) => id !== cid))}
                    >
                      -
                    </button>
                  </span>
                )
              })}
              <OverflowChipDropdown
                count={selectionExtraCount}
                ids={selectionExtraIds}
                getRowLabel={(id) => {
                  const n = channelLabel(id)
                  return n ? `#${n}` : id
                }}
                disabled={saving}
                onRemoveOne={(cid) => setSelectedIds((prev) => prev.filter((id) => id !== cid))}
                ariaMoreLabel="Show more channels"
              />
            </div>
          )}
          <div className="disabled-commands-save-row">
            <button
              type="button"
              className="settings-save-btn"
              onClick={() => void submitDisable()}
              disabled={saving || loading || !commandDraft.trim() || selectedIds.length === 0}
            >
              {saving ? 'Saving…' : 'Save disables'}
            </button>
          </div>
        </div>
      )}

      {addRuleMode === 'ignore' && (
        <div className="disabled-commands-add-controls">
          <span
            className="settings-label cmd-module-picker-label"
            id={`cmd-mgmt-ignore-ch-${guildId}`}
          >
            Channel
          </span>
          <div className="disabled-commands-channel-row">
            <ChannelDropdown
              channels={textChannels}
              categories={categories}
              value={ignorePickerChannel}
              onChange={(id) => {
                setIgnorePickerChannel(id)
                setAccessError(null)
              }}
              placeholder="Pick a text channel"
              saving={ignoreSaving || loading}
            />
          </div>
          <div className="disabled-commands-add-actions">
            <button
              type="button"
              className="settings-save-btn"
              onClick={() => {
                if (!ignorePickerChannel) return
                void submitIgnore(ignorePickerChannel).then(() => setIgnorePickerChannel(''))
              }}
              disabled={ignoreSaving || loading || !ignorePickerChannel}
            >
              {ignoreSaving ? 'Adding…' : 'Add channel'}
            </button>
          </div>
          <span className="settings-label cmd-module-picker-label" style={{ marginTop: '0.75rem' }}>
            Member
          </span>
          <div className="settings-input-row" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
            <input
              type="text"
              className="settings-input"
              inputMode="numeric"
              placeholder="Member ID"
              value={ignoreDraft}
              onChange={(e) => {
                setIgnoreDraft(e.target.value.replace(/\D/g, ''))
                setAccessError(null)
              }}
              disabled={ignoreSaving || loading}
            />
            <button
              type="button"
              className="settings-save-btn"
              onClick={() => void submitIgnore()}
              disabled={ignoreSaving || loading || ignoreDraft.replace(/\D/g, '').length < 17}
            >
              {ignoreSaving ? 'Adding…' : 'Add member'}
            </button>
          </div>
        </div>
      )}

      {addRuleMode === 'restrict' && (
        <div className="disabled-commands-add-controls">
          <span
            className="settings-label cmd-module-picker-label"
            id={`cmd-mgmt-restrict-cmd-${guildId}`}
          >
            Command
          </span>
          <CommandModulePicker
            commands={catalogCommands}
            value={restrictCommandDraft}
            onChange={(name) => {
              setRestrictCommandDraft(name)
              setAccessError(null)
            }}
            disabled={restrictSaving || loading}
            loading={commandsLoading}
            aria-labelledby={`cmd-mgmt-restrict-cmd-${guildId}`}
          />
          <div className="disabled-commands-channel-row">
            <RoleDropdown
              roles={restrictAssignableRoles}
              value={restrictRolePicker}
              onChange={setRestrictRolePicker}
              placeholder="Pick a role"
              saving={restrictSaving || loading}
            />
          </div>
          <div className="disabled-commands-add-actions">
            <button
              type="button"
              className="settings-save-btn"
              onClick={addRestrictRoleToSelection}
              disabled={restrictSaving || loading || !restrictRolePicker}
            >
              Add role
            </button>
            <button
              type="button"
              className="settings-save-btn welcome-message-remove-btn"
              onClick={() => setRestrictSelectedRoleIds([])}
              disabled={restrictSaving || loading || restrictSelectedRoleIds.length === 0}
            >
              Clear roles
            </button>
          </div>
          {restrictSelectedRoleIds.length > 0 && (
            <div className="disabled-commands-chips disabled-commands-chips--selection">
              {restrictSelectedRoleIds.slice(0, MAX_VISIBLE_ROLE_CHIPS).map((rid) => {
                const name = roleLabel(rid)
                if (!name) return null
                const hex = colorHex(roleById.get(rid)?.color ?? 0)
                return (
                  <span key={rid} className="disabled-commands-chip">
                    <span className="autorole-role" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {hex && <span className="autorole-role-dot" style={{ background: hex }} />}
                      @{name}
                    </span>
                    <button
                      type="button"
                      className="disabled-commands-chip-remove"
                      aria-label="Remove from selection"
                      disabled={restrictSaving}
                      onClick={() =>
                        setRestrictSelectedRoleIds((prev) => prev.filter((id) => id !== rid))
                      }
                    >
                      -
                    </button>
                  </span>
                )
              })}
              <OverflowChipDropdown
                count={Math.max(0, restrictSelectedRoleIds.length - MAX_VISIBLE_ROLE_CHIPS)}
                ids={restrictSelectedRoleIds.slice(MAX_VISIBLE_ROLE_CHIPS)}
                getRowLabel={(id) => {
                  const n = roleLabel(id)
                  return n ? `@${n}` : id
                }}
                disabled={restrictSaving}
                onRemoveOne={(id) =>
                  setRestrictSelectedRoleIds((prev) => prev.filter((x) => x !== id))
                }
                ariaMoreLabel="Show more roles"
              />
            </div>
          )}
          <div className="disabled-commands-save-row">
            <button
              type="button"
              className="settings-save-btn"
              onClick={() => void submitRestrict()}
              disabled={
                restrictSaving ||
                loading ||
                !restrictCommandDraft.trim() ||
                restrictSelectedRoleIds.length === 0
              }
            >
              {restrictSaving ? 'Saving…' : 'Save restrictions'}
            </button>
          </div>
        </div>
      )}
    </section>
  )

  if (loading) {
    return (
      <div className="general-settings-stack">
        <div className="general-settings-top-row">
          <section className="general-settings-pane">
            <PrefixSettings guildId={guildId} />
          </section>
          {addRulePanel}
        </div>
      </div>
    )
  }

  return (
    <div className="general-settings-stack">
      <div className="general-settings-top-row">
        <section className="general-settings-pane">
          <PrefixSettings guildId={guildId} />
        </section>
        {addRulePanel}
      </div>

      {(error || accessError) && (
        <div className="general-settings-access-errors">
          {error && <p className="settings-error">{error}</p>}
          {accessError && <p className="settings-error">{accessError}</p>}
        </div>
      )}

      <div className="general-settings-three-col">
        <section className="general-settings-pane general-settings-pane--cmd-col settings-field">
        <label className="settings-label">Ignored channels &amp; members</label>
        <p className="settings-desc">
          These targets cannot run commands in the server. Administrators are not blocked.
        </p>
        {ignoredTargetIds.length === 0 ? (
          <p className="settings-hint" style={{ marginTop: '0.5rem' }}>
            No ignored targets.
          </p>
        ) : (
          <div className="disabled-commands-chips" style={{ marginTop: '0.65rem' }}>
            {ignoredTargetIds.map((tid) => (
              <span key={tid} className="disabled-commands-chip">
                {targetDisplayLabel(tid)}
                <button
                  type="button"
                  className="disabled-commands-chip-remove"
                  aria-label="Remove ignore"
                  disabled={removingIgnore !== null}
                  onClick={() => void removeIgnoreTarget(tid)}
                >
                  {removingIgnore === tid ? '…' : '-'}
                </button>
              </span>
            ))}
          </div>
        )}
        </section>

        <section className="general-settings-pane general-settings-pane--cmd-col settings-field">
        <label className="settings-label">Command role restrictions</label>
        <p className="settings-desc">
          Only members with at least one of the listed roles may use the command (unless they have
          Administrator).
        </p>

        {restrictEntries.length === 0 ? (
          <p className="settings-hint" style={{ marginTop: '0.75rem' }}>
            No role restrictions configured.
          </p>
        ) : (
          <ul className="disabled-commands-list" style={{ marginTop: '0.65rem' }}>
            {restrictEntries.map((row) => {
              const visibleRids = row.role_ids.slice(0, MAX_VISIBLE_ROLE_CHIPS)
              const extraRids = row.role_ids.slice(MAX_VISIBLE_ROLE_CHIPS)
              const extraCount = extraRids.length
              return (
                <li key={row.command} className="disabled-commands-row">
                  <div className="disabled-commands-row-top">
                    <code className="disabled-commands-cmd">{row.command}</code>
                    <button
                      type="button"
                      className="disabled-commands-clear-all"
                      aria-label={`Clear all role restrictions for ${row.command}`}
                      title="Clear all"
                      disabled={removingRestrict !== null}
                      onClick={() => removeRestrict(row.command, row.role_ids, 'all')}
                    >
                      {removingRestrict === `${row.command}::rst-all` ? '…' : '-'}
                    </button>
                  </div>
                  <div className="disabled-commands-chips">
                    {visibleRids.map((rid) => {
                      const name = roleLabel(rid)
                      const hex = colorHex(roleById.get(rid)?.color ?? 0)
                      return (
                        <span key={rid} className="disabled-commands-chip">
                          <span
                            className="autorole-role"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          >
                            {hex && <span className="autorole-role-dot" style={{ background: hex }} />}
                            @{name ?? rid}
                          </span>
                          <button
                            type="button"
                            className="disabled-commands-chip-remove"
                            aria-label={`Remove @${name ?? rid}`}
                            disabled={removingRestrict !== null}
                            onClick={() => removeRestrict(row.command, [rid], 'one')}
                          >
                            {removingRestrict === `${row.command}::rst::${rid}` ? '…' : '-'}
                          </button>
                        </span>
                      )
                    })}
                    <OverflowChipDropdown
                      count={extraCount}
                      ids={extraRids}
                      getRowLabel={(id) => {
                        const n = roleLabel(id)
                        return n ? `@${n}` : id
                      }}
                      disabled={removingRestrict !== null}
                      onRemoveOne={(rid) => removeRestrict(row.command, [rid], 'one')}
                      ariaMoreLabel="Show more roles"
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        </section>

        <section className="general-settings-pane general-settings-pane--cmd-col settings-field">
        <label className="settings-label">Disabled commands</label>
        <p className="settings-desc">
          Choose where each command cannot be used. Members with Administrator in Discord are not
          blocked.
        </p>

        {entries.length === 0 ? (
          <p className="settings-hint" style={{ marginBottom: '1rem' }}>
            No commands are disabled for this server.
          </p>
        ) : (
          <ul className="disabled-commands-list">
            {entries.map((row) => {
              const knownIds = row.channel_ids.filter((id) => channelLabel(id) != null)
              const unknownIds = row.channel_ids.filter((id) => channelLabel(id) == null)
              const visibleKnownIds = knownIds.slice(0, MAX_VISIBLE_CHANNEL_CHIPS)
              const knownExtraIds = knownIds.slice(MAX_VISIBLE_CHANNEL_CHIPS)
              const knownExtraCount = knownExtraIds.length
              return (
                <li key={row.command} className="disabled-commands-row">
                  <div className="disabled-commands-row-top">
                    <code className="disabled-commands-cmd">{row.command}</code>
                    <button
                      type="button"
                      className="disabled-commands-clear-all"
                      aria-label={`Clear all disabled channels for ${row.command}`}
                      title="Clear all"
                      disabled={removing !== null}
                      onClick={() => removeChannels(row.command, row.channel_ids, 'all')}
                    >
                      {removing === `${row.command}::all` ? '…' : '-'}
                    </button>
                  </div>
                  {knownIds.length > 0 && (
                    <div className="disabled-commands-chips">
                      {visibleKnownIds.map((cid) => {
                        const name = channelLabel(cid)!
                        return (
                          <span key={cid} className="disabled-commands-chip">
                            #{name}
                            <button
                              type="button"
                              className="disabled-commands-chip-remove"
                              aria-label={`Remove #${name}`}
                              disabled={removing !== null}
                              onClick={() => removeChannels(row.command, [cid], 'one')}
                            >
                              {removing === `${row.command}::${cid}` ? '…' : '-'}
                            </button>
                          </span>
                        )
                      })}
                      <OverflowChipDropdown
                        count={knownExtraCount}
                        ids={knownExtraIds}
                        getRowLabel={(id) => {
                          const n = channelLabel(id)
                          return n ? `#${n}` : id
                        }}
                        disabled={removing !== null}
                        onRemoveOne={(cid) => removeChannels(row.command, [cid], 'one')}
                        ariaMoreLabel="Show more channels"
                      />
                    </div>
                  )}
                  {unknownIds.length > 0 && (
                    <p className="disabled-commands-stale">
                      {unknownIds.length} channel{unknownIds.length === 1 ? '' : 's'} not in this server’s channel list
                      (deleted, forum, or missing from cache).{' '}
                      <button
                        type="button"
                        className="disabled-commands-link-btn"
                        disabled={removing !== null}
                        onClick={() => removeChannels(row.command, unknownIds, 'purge-unknown')}
                      >
                        {removing === `${row.command}::purge-unknown` ? '…' : 'Remove those'}
                      </button>
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        </section>
      </div>
    </div>
  )
}
