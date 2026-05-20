'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type FocusEvent } from 'react'
import { RoleDropdown } from '@/components/settings/AnDropdowns'
import type { AnGuildRole } from '@/components/settings/AnDropdowns'
import {
  ScriptEditorModal,
  categoryLabel,
  type ScriptEditorModalMode,
} from '@/components/settings/SystemMessagesScriptModal'
import { useConfirm } from '@elira/components/shared/confirm-modal'
import {
  defaultEmbed,
  generateScript,
  parseScriptToEmbed,
  type EmbedButton,
  type EmbedData,
  type EmbedField,
} from '@elira/components/embeds/lib/types'
import type { ParsedEmbedPatch } from '@elira/components/embeds/lib/parse'
import type { PreviewContext } from '@elira/components/embeds/lib/preview'
import { fetchBundle } from '@/lib/bundle-client'
import { isDiscordCategoryChannel, isDiscordTextChannel } from '@elira/lib/guild/channel-type'
import {
  getDangerousPermissions,
  permissionLabel,
} from '@elira/lib/discord/permissions'
import type { GuildChannel, GuildMemberInfo, GuildRole } from '@/components/settings/types'
import { MAX_TAG_REWARD_ROLES, type TagRewardsState, type VanityRewardsState } from '@/lib/settings/rewards-types'
import { TAG_REWARDS_DEFAULT_TEMPLATE, vanityRewardsDefaultTemplate } from '@/lib/settings/rewards-constants'

export interface RewardsSettingsUser {
  id: string
  username: string
  display_name?: string | null
  avatar_url: string
}

function rolesToAn(roles: GuildRole[]): AnGuildRole[] {
  return roles.map((r) => ({ id: r.id, name: r.name, color: r.color }))
}

function PencilIcon() {
  return (
    <svg
      className="system-messages-icon-svg"
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
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  )
}

const DELETE_AFTER_RE = /\s*--delete_after\s+(\d+)\s*$/i

function extractDeleteAfter(template: string): { cleaned: string; deleteAfter: number | null } {
  const m = template.match(DELETE_AFTER_RE)
  if (!m || m.index == null) return { cleaned: template, deleteAfter: null }
  const n = parseInt(m[1], 10)
  if (!Number.isFinite(n) || n < 0) return { cleaned: template, deleteAfter: null }
  return { cleaned: template.slice(0, m.index).trimEnd(), deleteAfter: n }
}

function appendDeleteAfter(template: string, seconds: number): string {
  const base = template.replace(DELETE_AFTER_RE, '').trimEnd()
  return `${base} --delete_after ${seconds}`
}

type RewardModalKind = 'tag' | 'vanity'

export default function RewardsSettings({
  guildId,
  guildName,
  guildIconUrl,
  guildBannerUrl,
  vanityUrlCode,
  user,
}: {
  guildId: string
  guildName: string
  guildIconUrl: string | null
  guildBannerUrl?: string | null
  vanityUrlCode: string | null
  user: RewardsSettingsUser
}) {
  const { confirm, modal: confirmModal } = useConfirm()
  const previewContext: PreviewContext = useMemo(
    () => ({
      user: {
        id: user.id,
        name: user.username,
        display_name: user.display_name || user.username,
        avatar_url: user.avatar_url,
      },
      moderator: {
        id: user.id,
        name: user.username,
        display_name: user.display_name || user.username,
        avatar_url: user.avatar_url,
      },
      guild: {
        id: guildId,
        name: guildName,
        icon_url: guildIconUrl,
        banner_url: guildBannerUrl ?? null,
      },
    }),
    [guildId, guildName, guildIconUrl, guildBannerUrl, user]
  )

  const [tag, setTag] = useState<TagRewardsState | null>(null)
  const [vanity, setVanity] = useState<VanityRewardsState | null>(null)
  const [channels, setChannels] = useState<GuildChannel[]>([])
  const [categoryById, setCategoryById] = useState<Record<string, string>>({})
  const [guildRoles, setGuildRoles] = useState<GuildRole[]>([])
  const [me, setMe] = useState<GuildMemberInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [tagAddRoleId, setTagAddRoleId] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [modalKind, setModalKind] = useState<RewardModalKind>('tag')
  const [modalMode, setModalMode] = useState<ScriptEditorModalMode>('edit')
  const [draftChannelId, setDraftChannelId] = useState('')
  const [embed, setEmbed] = useState<EmbedData>(() => defaultEmbed())
  const [modalError, setModalError] = useState<string | null>(null)
  const [deleteAfterDraft, setDeleteAfterDraft] = useState('')
  const lastInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)

  const emptyUsedChannels = useMemo(() => new Set<string>(), [])

  const loadRewards = useCallback(async () => {
    const [tagRes, vanityRes] = await Promise.all([
      fetch(`/api/guilds/${guildId}/rewards/tag`, { credentials: 'same-origin' }),
      fetch(`/api/guilds/${guildId}/rewards/vanity`, { credentials: 'same-origin' }),
    ])
    const tagData = await tagRes.json().catch(() => ({}))
    const vanityData = await vanityRes.json().catch(() => ({}))
    if (!tagRes.ok) {
      throw new Error(typeof tagData.error === 'string' ? tagData.error : 'Failed to load tag rewards')
    }
    if (!vanityRes.ok) {
      throw new Error(
        typeof vanityData.error === 'string' ? vanityData.error : 'Failed to load vanity rewards'
      )
    }
    setTag(tagData.tag as TagRewardsState)
    setVanity(vanityData.vanity as VanityRewardsState)
  }, [guildId])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([fetchBundle(guildId, ['channels', 'roles', 'me']), loadRewards()])
      .then(([bundle]) => {
        if (cancelled) return
        const all = Array.isArray(bundle.channels) ? (bundle.channels as GuildChannel[]) : []
        const cats: Record<string, string> = {}
        for (const c of all) {
          if (isDiscordCategoryChannel(c)) cats[String(c.id)] = c.name
        }
        setCategoryById(cats)
        setChannels(all.filter((c) => isDiscordTextChannel(c)).sort((a, b) => a.position - b.position))
        const rs = bundle.roles
        if (Array.isArray(rs)) setGuildRoles(rs as GuildRole[])
        const meData = bundle.me
        if (meData && typeof meData === 'object' && 'top_role_position' in meData) {
          setMe(meData as GuildMemberInfo)
        }
      })
      .catch((e) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Failed to load rewards')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [guildId, loadRewards])

  const rolesById = useMemo(() => {
    const m = new Map<string, GuildRole>()
    for (const r of guildRoles) m.set(r.id, r)
    return m
  }, [guildRoles])

  const availableRoles = useMemo(() => guildRoles.filter((r) => !r.managed), [guildRoles])

  const roleEligibility = useCallback(
    (role: GuildRole): { ok: boolean; reason?: string } => {
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
    },
    [me]
  )

  const assignableRoleEntries = useMemo(
    () =>
      availableRoles.map((r) => {
        const e = roleEligibility(r)
        return { role: r, disabled: !e.ok, reason: e.reason }
      }),
    [availableRoles, roleEligibility]
  )

  const anRoles = useMemo(() => rolesToAn(availableRoles), [availableRoles])

  const channelName = (id: string) => channels.find((c) => c.id === id)?.name ?? id

  const patchTag = async (body: Record<string, unknown>) => {
    setError(null)
    try {
      const res = await fetch(`/api/guilds/${guildId}/rewards/tag`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Save failed')
        return false
      }
      setTag(data.tag as TagRewardsState)
      return true
    } catch {
      setError('Save failed')
      return false
    }
  }

  const patchVanity = async (body: Record<string, unknown>) => {
    setError(null)
    try {
      const res = await fetch(`/api/guilds/${guildId}/rewards/vanity`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Save failed')
        return false
      }
      setVanity(data.vanity as VanityRewardsState)
      return true
    } catch {
      setError('Save failed')
      return false
    }
  }

  const closeModal = () => {
    setModalOpen(false)
    setModalError(null)
    setDeleteAfterDraft('')
  }

  const openEditModal = (kind: RewardModalKind) => {
    const row = kind === 'tag' ? tag : vanity
    if (!row) return
    const chId =
      kind === 'tag'
        ? row.channel_id ?? channels[0]?.id ?? ''
        : row.channel_id ?? channels[0]?.id ?? ''
    setModalKind(kind)
    setModalMode('edit')
    setModalError(null)
    setDraftChannelId(chId)
    const raw = kind === 'tag' ? tag?.template ?? '' : vanity?.template ?? ''
    const { cleaned, deleteAfter } = extractDeleteAfter(raw)
    setDeleteAfterDraft(deleteAfter != null ? String(deleteAfter) : '')
    try {
      setEmbed(cleaned.trim() ? parseScriptToEmbed(cleaned) : defaultEmbed())
    } catch {
      setEmbed(defaultEmbed())
    }
    setModalOpen(true)
  }

  const handleEditorFocus = useCallback((e: FocusEvent) => {
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      lastInputRef.current = target as HTMLInputElement | HTMLTextAreaElement
    }
  }, [])

  const insertVariable = useCallback((variable: string) => {
    const el = lastInputRef.current
    if (!el) return
    const start = el.selectionStart ?? el.value.length
    const end = el.selectionEnd ?? el.value.length
    const newValue = el.value.slice(0, start) + variable + el.value.slice(end)
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
    if (setter) {
      setter.call(el, newValue)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }
    el.focus()
    const cursor = start + variable.length
    el.setSelectionRange(cursor, cursor)
  }, [])

  const update = useCallback(<K extends keyof EmbedData>(key: K, value: EmbedData[K]) => {
    setEmbed((prev) => ({ ...prev, [key]: value }))
  }, [])

  const updateAuthor = useCallback((key: keyof EmbedData['author'], value: string) => {
    setEmbed((prev) => ({ ...prev, author: { ...prev.author, [key]: value } }))
  }, [])

  const updateFooter = useCallback((key: keyof EmbedData['footer'], value: string) => {
    setEmbed((prev) => ({ ...prev, footer: { ...prev.footer, [key]: value } }))
  }, [])

  const addField = useCallback(() => {
    setEmbed((prev) => ({ ...prev, fields: [...prev.fields, { name: '', value: '', inline: false }] }))
  }, [])

  const updateField = useCallback((index: number, key: keyof EmbedField, value: string | boolean) => {
    setEmbed((prev) => ({
      ...prev,
      fields: prev.fields.map((f, i) => (i === index ? { ...f, [key]: value } : f)),
    }))
  }, [])

  const removeField = useCallback((index: number) => {
    setEmbed((prev) => ({ ...prev, fields: prev.fields.filter((_, i) => i !== index) }))
  }, [])

  const addButton = useCallback(() => {
    setEmbed((prev) => ({
      ...prev,
      buttons: [...prev.buttons, { style: 'link', label: '', url: '', emoji: '', disabled: false }],
    }))
  }, [])

  const updateButton = useCallback((index: number, key: keyof EmbedButton, value: string | boolean) => {
    setEmbed((prev) => ({
      ...prev,
      buttons: prev.buttons.map((b, i) => (i === index ? { ...b, [key]: value } : b)),
    }))
  }, [])

  const removeButton = useCallback((index: number) => {
    setEmbed((prev) => ({ ...prev, buttons: prev.buttons.filter((_, i) => i !== index) }))
  }, [])

  const applyEmbedPatch = useCallback((patch: ParsedEmbedPatch) => {
    setEmbed((prev) => {
      const next: EmbedData = { ...prev }
      if (patch.content !== undefined) next.content = patch.content
      if (patch.color !== undefined) next.color = patch.color
      if (patch.url !== undefined) next.url = patch.url
      if (patch.title !== undefined) next.title = patch.title
      if (patch.description !== undefined) next.description = patch.description
      if (patch.thumbnail !== undefined) next.thumbnail = patch.thumbnail
      if (patch.image !== undefined) next.image = patch.image
      if (patch.timestamp !== undefined) next.timestamp = patch.timestamp
      if (patch.footer) next.footer = patch.footer
      if (patch.author) next.author = patch.author
      if (patch.addFields?.length) next.fields = [...prev.fields, ...patch.addFields]
      if (patch.addButtons?.length) next.buttons = [...prev.buttons, ...patch.addButtons]
      return next
    })
  }, [])

  const saveModal = async () => {
    if (!draftChannelId) {
      setModalError('Select a channel.')
      return
    }
    let template = generateScript(embed).trim()
    if (!template) {
      setModalError('Add message content or embed fields before saving.')
      return
    }
    if (deleteAfterDraft.trim() !== '') {
      const n = parseInt(deleteAfterDraft.trim(), 10)
      if (Number.isNaN(n) || n < 0) {
        setModalError('Auto-delete must be a non-negative number.')
        return
      }
      template = appendDeleteAfter(template, n)
    }
    setSaving(true)
    setModalError(null)
    const ok =
      modalKind === 'tag'
        ? await patchTag({ channel_id: draftChannelId, template })
        : await patchVanity({ channel_id: draftChannelId, template })
    setSaving(false)
    if (ok) closeModal()
    else setModalError('Could not save. Check the message above or try again.')
  }

  const clearTagChannel = async () => {
    const ok = await confirm({
      title: 'Clear notification channel?',
      description: 'Tag reward notifications will not be sent until you pick a channel again.',
      confirmLabel: 'Clear',
      destructive: true,
    })
    if (!ok) return
    await patchTag({ channel_id: null })
  }

  const clearVanityChannel = async () => {
    const ok = await confirm({
      title: 'Clear notification channel?',
      description: 'Vanity reward notifications will not be sent until you pick a channel again.',
      confirmLabel: 'Clear',
      destructive: true,
    })
    if (!ok) return
    await patchVanity({ channel_id: null })
  }

  const clearTemplate = async (kind: RewardModalKind) => {
    const ok = await confirm({
      title: kind === 'tag' ? 'Reset tag notification message?' : 'Reset vanity notification message?',
      description: 'The bot will use its built-in default text for new notifications.',
      confirmLabel: 'Reset',
      destructive: true,
    })
    if (!ok) return
    if (kind === 'tag') await patchTag({ template: null })
    else await patchVanity({ template: null })
  }

  if (loading || !tag || !vanity) {
    return <div className="settings-loading">Loading…</div>
  }

  const tagCh = tag.channel_id ? channels.find((c) => c.id === tag.channel_id) : undefined
  const vanityCh = vanity.channel_id ? channels.find((c) => c.id === vanity.channel_id) : undefined

  const modalTitles =
    modalKind === 'tag'
      ? { add: 'Tag reward notification', edit: 'Edit tag reward notification' }
      : { add: 'Vanity reward notification', edit: 'Edit vanity reward notification' }

  const tagDeleteAfter = extractDeleteAfter(tag.template ?? '').deleteAfter
  const vanityDeleteAfter = extractDeleteAfter(vanity.template ?? '').deleteAfter

  return (
    <div className="system-messages-stack">
      {confirmModal}
      {error && <p className="settings-error">{error}</p>}

      <div className="system-messages-kinds-grid rewards-kinds-grid">
        <div className="settings-field system-messages-section">
          <div className="system-messages-section-head">
            <label className="settings-label system-messages-section-label">Guild tag rewards</label>
          </div>
          <p className="settings-hint system-messages-section-hint">
            When someone sets this server as their primary profile tag, grant roles and send an optional notification.
          </p>
          <div className="system-messages-section-body">
            <div className="an-modules welcome-message-modules system-messages-modules">
              <div className="an-module welcome-message-module" style={{ animationDelay: '0.03s' }}>
                <div className="an-module-header">
                  <span className="an-module-name welcome-message-module-title">
                    <span>
                      {tag.channel_id ? `#${channelName(tag.channel_id)}` : 'Notification'}
                    </span>
                    <span className="welcome-message-title-sep" aria-hidden>
                      ·
                    </span>
                    <span className="welcome-message-title-category">
                      {categoryLabel(tagCh?.parent_id ?? null, categoryById)}
                      {tagDeleteAfter != null && (
                        <span style={{ opacity: 0.75, fontWeight: 500 }}>{` · auto-delete ${tagDeleteAfter}s`}</span>
                      )}
                    </span>
                  </span>
                  <div className="welcome-message-module-actions">
                    <button
                      type="button"
                      className="system-messages-icon-btn system-messages-edit-btn"
                      onClick={() => openEditModal('tag')}
                      aria-label="Edit tag notification"
                      title="Edit notification"
                    >
                      <PencilIcon />
                    </button>
                    <button
                      type="button"
                      className="system-messages-icon-btn system-messages-minus-btn"
                      onClick={() => void clearTagChannel()}
                      disabled={!tag.channel_id}
                      aria-label="Clear notification channel"
                      title="Clear channel"
                    >
                      -
                    </button>
                  </div>
                </div>
                <span className="an-module-desc welcome-message-channel-id">
                  {tag.channel_id ?? 'No channel — open edit to choose one'}
                </span>
                <hr className="rewards-card-separator" aria-hidden />
                <div className="rewards-card-inline">
                  <span className="settings-label" style={{ fontSize: '0.72rem', marginBottom: 6, display: 'block' }}>
                    Roles to grant
                  </span>
                  <div className="rewards-role-chips">
                    {tag.role_ids.length === 0 ? (
                      <span className="rewards-muted">No roles yet</span>
                    ) : (
                      tag.role_ids.map((rid) => {
                        const r = rolesById.get(rid)
                        return (
                          <span key={rid} className="rewards-chip">
                            <span className="autorole-role">
                              {r && (
                                <span
                                  className="autorole-role-dot"
                                  style={
                                    r.color
                                      ? { background: `#${r.color.toString(16).padStart(6, '0')}` }
                                      : undefined
                                  }
                                />
                              )}
                              <span className="autorole-role-name">{r?.name ?? rid}</span>
                            </span>
                            <button
                              type="button"
                              className="system-messages-icon-btn system-messages-minus-btn"
                              aria-label={`Remove ${r?.name ?? 'role'}`}
                              onClick={() =>
                                void patchTag({ role_ids: tag.role_ids.filter((x) => x !== rid) })
                              }
                            >
                              −
                            </button>
                          </span>
                        )
                      })
                    )}
                  </div>
                  <div className="rewards-add-role-row">
                    <RoleDropdown
                      roles={anRoles}
                      entries={assignableRoleEntries}
                      value={tagAddRoleId}
                      onChange={(id) => {
                        setTagAddRoleId('')
                        if (!id || tag.role_ids.includes(id) || tag.role_ids.length >= MAX_TAG_REWARD_ROLES) return
                        void patchTag({ role_ids: [...tag.role_ids, id] })
                      }}
                      placeholder={
                        tag.role_ids.length >= MAX_TAG_REWARD_ROLES
                          ? `Max ${MAX_TAG_REWARD_ROLES} roles`
                          : 'Add role…'
                      }
                    />
                  </div>
                  {tag.template && (
                    <div className="settings-input-row" style={{ marginTop: 10 }}>
                      <button
                        type="button"
                        className="settings-save-btn welcome-message-remove-btn"
                        onClick={() => void clearTemplate('tag')}
                      >
                        Reset message to default
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          className={`settings-field system-messages-section${!vanityUrlCode ? ' rewards-vanity-locked' : ''}`}
        >
          <div className="system-messages-section-head">
            <label className="settings-label system-messages-section-label">Vanity URL rewards</label>
          </div>
          <p className="settings-hint system-messages-section-hint">
            When someone puts your vanity invite in their custom status, grant a role and notify a channel.
          </p>
          {!vanityUrlCode && (
            <p className="rewards-vanity-hint">
              This server does not have a vanity URL yet. Set one under Discord → Server Settings → Vanity URL.
            </p>
          )}
          <div className="system-messages-section-body">
            <div className="an-modules welcome-message-modules system-messages-modules">
              <div className="an-module welcome-message-module" style={{ animationDelay: '0.06s' }}>
                <div className="an-module-header">
                  <span className="an-module-name welcome-message-module-title">
                    <span>
                      {vanity.channel_id ? `#${channelName(vanity.channel_id)}` : 'Notification'}
                    </span>
                    <span className="welcome-message-title-sep" aria-hidden>
                      ·
                    </span>
                    <span className="welcome-message-title-category">
                      {categoryLabel(vanityCh?.parent_id ?? null, categoryById)}
                      {vanityDeleteAfter != null && (
                        <span style={{ opacity: 0.75, fontWeight: 500 }}>{` · auto-delete ${vanityDeleteAfter}s`}</span>
                      )}
                    </span>
                  </span>
                  <div className="welcome-message-module-actions">
                    <button
                      type="button"
                      className="system-messages-icon-btn system-messages-edit-btn"
                      onClick={() => vanityUrlCode && openEditModal('vanity')}
                      disabled={!vanityUrlCode}
                      aria-label="Edit vanity notification"
                      title="Edit notification"
                    >
                      <PencilIcon />
                    </button>
                    <button
                      type="button"
                      className="system-messages-icon-btn system-messages-minus-btn"
                      onClick={() => void clearVanityChannel()}
                      disabled={!vanityUrlCode || !vanity.channel_id}
                      aria-label="Clear notification channel"
                      title="Clear channel"
                    >
                      -
                    </button>
                  </div>
                </div>
                <span className="an-module-desc welcome-message-channel-id">
                  {vanity.channel_id ?? 'No channel — open edit to choose one'}
                </span>
                <hr className="rewards-card-separator" aria-hidden />
                <div className="rewards-card-inline">
                  <span className="settings-label" style={{ fontSize: '0.72rem', marginBottom: 6, display: 'block' }}>
                    Role to grant
                  </span>
                  <RoleDropdown
                    roles={anRoles}
                    entries={assignableRoleEntries}
                    value={vanity.role_id ?? ''}
                    onChange={(id) => void patchVanity({ role_id: id || null })}
                    placeholder="Pick a role…"
                    saving={!vanityUrlCode}
                  />
                  {vanity.template && (
                    <div className="settings-input-row" style={{ marginTop: 10 }}>
                      <button
                        type="button"
                        className="settings-save-btn welcome-message-remove-btn"
                        onClick={() => void clearTemplate('vanity')}
                        disabled={!vanityUrlCode}
                      >
                        Reset message to default
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ScriptEditorModal
        open={modalOpen}
        mode={modalMode}
        guildName={guildName}
        guildIconUrl={guildIconUrl}
        channels={channels}
        categoryById={categoryById}
        usedChannelIds={emptyUsedChannels}
        draftChannelId={draftChannelId}
        setDraftChannelId={setDraftChannelId}
        embed={embed}
        saving={saving}
        modalError={modalError}
        onClose={closeModal}
        onSave={() => void saveModal()}
        lastInputRef={lastInputRef}
        handleEditorFocus={handleEditorFocus}
        insertVariable={insertVariable}
        update={update}
        updateAuthor={updateAuthor}
        updateFooter={updateFooter}
        addField={addField}
        updateField={updateField}
        removeField={removeField}
        addButton={addButton}
        updateButton={updateButton}
        removeButton={removeButton}
        applyEmbedPatch={applyEmbedPatch}
        previewContext={previewContext}
        titleAdd={modalTitles.add}
        titleEdit={modalTitles.edit}
        channelHint={
          modalKind === 'tag'
            ? 'Where tag reward notifications are sent when someone reps your server tag.'
            : 'Where vanity reward notifications are sent when someone adds your vanity URL to their status.'
        }
        modalSubtitle="Pick the notification channel, then build the script (same editor as System Messages)."
        showDeleteAfter
        deleteAfterDraft={deleteAfterDraft}
        setDeleteAfterDraft={setDeleteAfterDraft}
      />
    </div>
  )
}
