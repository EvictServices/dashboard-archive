'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  getDangerousPermissions,
  permissionLabel,
} from '@elira/lib/discord/permissions'
import { useConfirm } from '@elira/components/shared/confirm-modal'
import { Dropdown, RoleDropdown } from '@/components/settings/AnDropdowns'
import { fetchBundle } from '@/lib/bundle-client'
import {
  colorHex,
  type GuildMemberInfo,
  type GuildRole,
} from '@/components/settings/types'
import { MIN_DELAY, MAX_DELAY, type AutoroleEntry } from '@/lib/settings/autorole-types'

interface AutoroleSettingsData {
  roles: AutoroleEntry[]
  reassign_roles: boolean
  reassign_ignore_ids: string[]
}

export default function AutoroleSettings({ guildId }: { guildId: string }) {
  const [settings, setSettings] = useState<AutoroleSettingsData | null>(null)
  const [roles, setRoles] = useState<GuildRole[]>([])
  const [me, setMe] = useState<GuildMemberInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [newRoleId, setNewRoleId] = useState<string>('')
  const [newAction, setNewAction] = useState<'add' | 'remove'>('add')
  const [newDelay, setNewDelay] = useState<string>('')
  const { confirm, modal: confirmModal } = useConfirm()

  useEffect(() => {
    let cancelled = false
    fetchBundle(guildId, ['autorole', 'roles', 'me'])
      .then((data) => {
        if (cancelled) return
        const settingsData = data.autorole as AutoroleSettingsData | null
        const rolesData = data.roles
        const meData = data.me
        if (settingsData) setSettings(settingsData)
        if (Array.isArray(rolesData)) setRoles(rolesData as GuildRole[])
        if (meData && typeof meData === 'object' && 'top_role_position' in meData) {
          setMe(meData as GuildMemberInfo)
        }
      })
      .catch(() => {
        if (cancelled) return
        setError('Failed to load autorole settings')
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [guildId])

  const rolesById = useMemo(() => {
    const map = new Map<string, GuildRole>()
    for (const role of roles) map.set(role.id, role)
    return map
  }, [roles])

  const usedRoleIds = useMemo(
    () => new Set((settings?.roles ?? []).map((r) => `${r.role_id}:${r.action}`)),
    [settings]
  )

  const callApi = async (op: string, payload: Record<string, unknown>, savingKey: string) => {
    setSaving(savingKey)
    setError(null)
    try {
      const res = await fetch(`/api/guilds/${guildId}/autorole`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op, ...payload }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to save')
        return false
      }
      setSettings(data)
      return true
    } catch {
      setError('Failed to save')
      return false
    } finally {
      setSaving(null)
    }
  }

  const handleAdd = async () => {
    if (!newRoleId) {
      setError('Pick a role to assign')
      return
    }

    let delay: number | null = null
    if (newDelay) {
      const parsed = Number(newDelay)
      if (!Number.isFinite(parsed) || parsed < MIN_DELAY || parsed > MAX_DELAY) {
        setError(`Delay must be between ${MIN_DELAY} and ${MAX_DELAY} seconds`)
        return
      }
      delay = parsed
    }
    if (newAction === 'remove' && !delay) {
      setError('A delay is required when removing a role')
      return
    }

    if (usedRoleIds.has(`${newRoleId}:${newAction}`)) {
      setError('This role already has an autorole entry for that action')
      return
    }

    const ok = await callApi('add', { role_id: newRoleId, action: newAction, delay }, `add:${newRoleId}`)
    if (ok) {
      setNewRoleId('')
      setNewDelay('')
      setNewAction('add')
    }
  }

  const handleRemove = (entry: AutoroleEntry) => {
    callApi('remove', { role_id: entry.role_id, action: entry.action }, `rm:${entry.role_id}:${entry.action}`)
  }

  const handleClear = async () => {
    if (!settings || settings.roles.length === 0) return
    const ok = await confirm({
      title: 'Clear all auto roles?',
      description:
        'Every configured auto role will be removed. New members joining the server will no longer receive any roles automatically.',
      confirmLabel: 'Clear all',
      cancelLabel: 'Cancel',
      destructive: true,
    })
    if (!ok) return
    callApi('clear', {}, 'clear')
  }

  const handleReassignToggle = () => {
    if (!settings) return
    callApi('reassign', { enabled: !settings.reassign_roles }, 'reassign')
  }

  const handleAddIgnore = (roleId: string) => {
    if (!settings) return
    if (settings.reassign_ignore_ids.includes(roleId)) return
    callApi(
      'reassign_ignore',
      { role_ids: [...settings.reassign_ignore_ids, roleId] },
      `ignore:${roleId}`
    )
  }

  const handleRemoveIgnore = (roleId: string) => {
    if (!settings) return
    callApi(
      'reassign_ignore',
      { role_ids: settings.reassign_ignore_ids.filter((id) => id !== roleId) },
      `unignore:${roleId}`
    )
  }

  if (loading) {
    return <div className="settings-loading">Loading...</div>
  }

  if (!settings) {
    return <div className="settings-error">Failed to load settings</div>
  }

  const availableRoles = roles.filter((r) => !r.managed)

  const roleEligibility = (role: GuildRole): { ok: boolean; reason?: string } => {
    if (!me) return { ok: true }
    if (!me.is_owner && role.position >= me.top_role_position) {
      return { ok: false, reason: 'Above your highest role' }
    }
    const dangerous = getDangerousPermissions(role.permissions ?? '0')
    if (dangerous.length > 0) {
      return {
        ok: false,
        reason: `Has ${dangerous.map(permissionLabel).join(', ')}`,
      }
    }
    return { ok: true }
  }

  const assignableRoles: { role: GuildRole; disabled: boolean; reason?: string }[] =
    availableRoles.map((r) => {
      const e = roleEligibility(r)
      return { role: r, disabled: !e.ok, reason: e.reason }
    })

  const unignoredRoles = availableRoles.filter(
    (r) => !settings.reassign_ignore_ids.includes(r.id)
  )

  return (
    <>
    <div className="autorole-settings">
      {error && <p className="settings-error">{error}</p>}

      <div className="an-module enabled" style={{ animationDelay: '0.03s' }}>
        <div className="an-module-header">
          <span className="an-module-name">Add an auto role</span>
        </div>
        <span className="an-module-desc">
          Assign or remove a role automatically when a member joins. Delay is in seconds (1–160).
        </span>
        <div className="an-module-body">
          <div className="autorole-add-fields">
            <div className="autorole-add-box">
              <div className="an-edit-field">
                <label>Role</label>
                <RoleDropdown
                  roles={availableRoles}
                  entries={assignableRoles}
                  value={newRoleId}
                  onChange={setNewRoleId}
                  placeholder="Select a role"
                />
              </div>
            </div>
            <div className="autorole-add-box">
              <div className="an-edit-field">
                <label>Action</label>
                <Dropdown
                  value={newAction}
                  options={[
                    { value: 'add', label: 'Add to new members' },
                    { value: 'remove', label: 'Remove after delay' },
                  ]}
                  onChange={(v) => setNewAction(v as 'add' | 'remove')}
                />
              </div>
            </div>
            <div className="autorole-add-box">
              <div className="an-edit-field">
                <label>Delay (seconds){newAction === 'remove' ? ' — required' : ' — optional'}</label>
                <input
                  type="number"
                  min={MIN_DELAY}
                  max={MAX_DELAY}
                  value={newDelay}
                  onChange={(e) => setNewDelay(e.target.value)}
                  className="settings-input"
                  placeholder={newAction === 'remove' ? 'e.g. 60' : 'Optional (1–160)'}
                />
              </div>
            </div>
          </div>
          <div className="settings-input-row">
            <button
              className="settings-save-btn"
              onClick={handleAdd}
              disabled={saving !== null || !newRoleId}
            >
              {saving?.startsWith('add:') ? 'Saving...' : 'Add auto role'}
            </button>
          </div>
        </div>
      </div>

      <div className="autorole-two-col">
      <div className="autorole-pair-row">
        <div className="autorole-pair-cell">
          <div className="an-module enabled" style={{ animationDelay: '0.06s' }}>
            <div className="an-module-header">
              <span className="an-module-name">
                Configured roles{settings.roles.length > 0 ? ` (${settings.roles.length})` : ''}
              </span>
              {settings.roles.length > 0 && (
                <button
                  type="button"
                  className="system-messages-icon-btn system-messages-minus-btn"
                  onClick={handleClear}
                  disabled={saving === 'clear'}
                  aria-label="Clear all auto roles"
                  title="Clear all"
                >
                  {saving === 'clear' ? '…' : '-'}
                </button>
              )}
            </div>
            <span className="an-module-desc">
              Roles currently scheduled to be applied or removed when members join.
            </span>
            <div className="an-module-body">
              {settings.roles.length === 0 ? (
                <p className="settings-hint" style={{ margin: 0 }}>
                  No auto roles configured yet.
                </p>
              ) : (
                <div className="autorole-list">
                  {settings.roles.map((entry) => {
                    const role = rolesById.get(entry.role_id)
                    const hex = role ? colorHex(role.color) : null
                    const key = `rm:${entry.role_id}:${entry.action}`
                    return (
                      <div key={`${entry.role_id}:${entry.action}`} className="autorole-row">
                        <span className="autorole-role">
                          <span
                            className="autorole-role-dot"
                            style={hex ? { background: hex } : undefined}
                          />
                          <span className="autorole-role-name">
                            {role ? role.name : `Unknown role · ${entry.role_id}`}
                          </span>
                        </span>
                        <span className={`autorole-pill autorole-pill-${entry.action}`}>
                          {entry.action === 'add' ? 'Add' : 'Remove'}
                        </span>
                        <span className="autorole-delay">
                          {entry.delay ? `after ${entry.delay}s` : 'instant'}
                        </span>
                        <button
                          type="button"
                          className="autorole-remove-btn"
                          onClick={() => handleRemove(entry)}
                          disabled={saving === key}
                          aria-label={`Remove ${entry.action} rule for ${role ? role.name : entry.role_id}`}
                          title="Remove"
                        >
                          {saving === key ? '…' : '-'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="autorole-pair-cell">
          <div
            className={`an-module ${settings.reassign_roles ? 'enabled' : ''}`}
            style={{ animationDelay: '0.09s' }}
          >
            <div className="an-module-header">
              <span className="an-module-name">Reassign roles on rejoin</span>
              <button
                className={`an-toggle ${settings.reassign_roles ? 'on' : ''}`}
                onClick={handleReassignToggle}
                disabled={saving === 'reassign' || settings.roles.length === 0}
              >
                <span className="an-toggle-knob" />
              </button>
            </div>
            <span className="an-module-desc">
              Restore roles a member had before leaving when they rejoin the server. Requires at least
              one configured auto role.
            </span>
            {settings.reassign_roles && (
              <div className="an-module-body">
                <div className="an-edit-field">
                  <label>Ignored roles</label>
                  <RoleDropdown
                    roles={unignoredRoles}
                    value=""
                    onChange={(id) => id && handleAddIgnore(id)}
                    placeholder="Add a role to ignore"
                  />
                </div>
                {settings.reassign_ignore_ids.length > 0 && (
                  <div className="autorole-list">
                    {settings.reassign_ignore_ids.map((roleId) => {
                      const role = rolesById.get(roleId)
                      const hex = role ? colorHex(role.color) : null
                      const key = `unignore:${roleId}`
                      return (
                        <div key={roleId} className="autorole-row">
                          <span className="autorole-role">
                            <span
                              className="autorole-role-dot"
                              style={hex ? { background: hex } : undefined}
                            />
                            <span className="autorole-role-name">
                              {role ? role.name : `Unknown role · ${roleId}`}
                            </span>
                          </span>
                          <button
                            className="autorole-remove-btn"
                            onClick={() => handleRemoveIgnore(roleId)}
                            disabled={saving === key}
                          >
                            {saving === key ? '…' : 'Stop ignoring'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
    </div>
    {confirmModal}
    </>
  )
}
