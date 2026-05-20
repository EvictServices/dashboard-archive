'use client'

import { useEffect, useMemo, useState } from 'react'
import { useConfirm } from '@elira/components/shared/confirm-modal'
import { ChannelDropdown, Dropdown, RoleDropdown } from '@/components/settings/AnDropdowns'
import { fetchBundle } from '@/lib/bundle-client'
import { isDiscordCategoryChannel, isDiscordTextChannel } from '@elira/lib/guild/channel-type'
import {
  colorHex,
  type GuildChannel,
  type GuildRole,
} from '@/components/settings/types'

interface TicketConfigPublic {
  guild_id: string
  panel_channel_id: string
  panel_message_id: string
  channel_name: string | null
  staff_ids: string[]
  blacklisted_ids: string[]
}

interface TicketButtonPublic {
  identifier: string
  template: string | null
  category_id: string | null
  topic: string | null
}

interface TicketSettingsData {
  configured: boolean
  config: TicketConfigPublic | null
  logs_channel_id: string | null
  buttons: TicketButtonPublic[]
  open_ticket_count: number
}

export default function TicketsSettings({ guildId }: { guildId: string }) {
  const [data, setData] = useState<TicketSettingsData | null>(null)
  const [textChannels, setTextChannels] = useState<GuildChannel[]>([])
  const [categories, setCategories] = useState<GuildChannel[]>([])
  const [roles, setRoles] = useState<GuildRole[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [channelNameDraft, setChannelNameDraft] = useState('')
  const [blacklistDraft, setBlacklistDraft] = useState('')
  const [staffRoleDraft, setStaffRoleDraft] = useState('')

  const [buttonDrafts, setButtonDrafts] = useState<
    Record<string, { template: string; category_id: string }>
  >({})

  const { confirm, modal: confirmModal } = useConfirm()

  useEffect(() => {
    let cancelled = false
    fetchBundle(guildId, ['tickets', 'channels', 'roles'])
      .then((bundle) => {
        if (cancelled) return
        const ticketData = bundle.tickets as TicketSettingsData | null
        if (ticketData) {
          setData(ticketData)
          if (ticketData.config?.channel_name != null) {
            setChannelNameDraft(ticketData.config.channel_name)
          } else {
            setChannelNameDraft('')
          }
        }
        const allChannels = Array.isArray(bundle.channels)
          ? (bundle.channels as GuildChannel[])
          : []
        setTextChannels(allChannels.filter((c) => isDiscordTextChannel(c)))
        setCategories(allChannels.filter((c) => isDiscordCategoryChannel(c)))
        if (Array.isArray(bundle.roles)) setRoles(bundle.roles as GuildRole[])
      })
      .catch(() => {
        if (cancelled) return
        setError('Failed to load ticket settings')
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [guildId])

  useEffect(() => {
    if (!data?.buttons) return
    const next: Record<string, { template: string; category_id: string }> = {}
    for (const b of data.buttons) {
      next[b.identifier] = {
        template: b.template ?? '',
        category_id: b.category_id ?? '',
      }
    }
    setButtonDrafts(next)
  }, [data?.buttons])

  const rolesById = useMemo(() => {
    const m = new Map<string, GuildRole>()
    for (const r of roles) m.set(r.id, r)
    return m
  }, [roles])

  const patch = async (body: Record<string, unknown>, key: string) => {
    setSaving(key)
    setError(null)
    try {
      const res = await fetch(`/api/guilds/${guildId}/tickets`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Failed to save')
        return false
      }
      setData(json as TicketSettingsData)
      if (json?.config?.channel_name != null) {
        setChannelNameDraft(json.config.channel_name)
      } else if (body.op === 'set_channel_name') {
        setChannelNameDraft('')
      }
      return true
    } catch {
      setError('Failed to save')
      return false
    } finally {
      setSaving(null)
    }
  }

  const handleDeleteButton = async (identifier: string) => {
    const ok = await confirm({
      title: 'Remove this ticket button?',
      description:
        `This removes the "${identifier}" row from the database. The Discord panel message may still show the button until you edit it in Discord; users who click it will see a message that the button is no longer valid.`,
      confirmLabel: 'Remove button',
      cancelLabel: 'Cancel',
      destructive: true,
    })
    if (!ok) return
    await patch({ op: 'delete_button', identifier }, `del-btn-${identifier}`)
  }

  if (loading) {
    return <div className="settings-loading">Loading...</div>
  }

  if (!data) {
    return <div className="settings-error">Failed to load ticket settings</div>
  }

  const panelJump =
    data.config &&
    `https://discord.com/channels/${guildId}/${data.config.panel_channel_id}/${data.config.panel_message_id}`

  return (
    <>
      <div className="autorole-settings">
        {error && <p className="settings-error">{error}</p>}

        {!data.configured && (
          <div className="an-module" style={{ animationDelay: '0.03s' }}>
            <div className="an-module-header">
              <span className="an-module-name">Tickets not configured</span>
            </div>
            <span className="an-module-desc">
              Run <span className="ticket-cmd">;ticket setup</span> or{' '}
              <span className="ticket-cmd">;ticket panel</span> in Discord to create the panel message
              and buttons. Then you can manage staff, transcripts, welcome text, and buttons here.
            </span>
          </div>
        )}

        {data.configured && data.config && (
          <>
            <div className="an-module enabled" style={{ animationDelay: '0.04s' }}>
              <div className="an-module-header">
                <span className="an-module-name">Panel & status</span>
              </div>
              <span className="an-module-desc">
                Edit the panel embed and add new buttons in Discord.{' '}
                {panelJump && (
                  <a className="ticket-panel-link" href={panelJump} target="_blank" rel="noreferrer">
                    Open panel message
                  </a>
                )}
              </span>
              <div className="an-module-body">
                <div className="an-edit-field">
                  <label>Open tickets</label>
                  <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                    {data.open_ticket_count}
                  </p>
                </div>
              </div>
            </div>

            <div className="an-module enabled" style={{ animationDelay: '0.06s' }}>
              <div className="an-module-header">
                <span className="an-module-name">Transcript channel</span>
              </div>
              <span className="an-module-desc">
                When a ticket is closed, the transcript log embed is sent to this channel.
              </span>
              <div className="an-module-body">
                <div className="an-edit-field">
                  <label>Channel</label>
                  <ChannelDropdown
                    channels={textChannels}
                    categories={categories}
                    value={data.logs_channel_id ?? ''}
                    emptyOption={{ label: 'Disabled' }}
                    placeholder="Select a channel"
                    saving={saving === 'logs'}
                    onChange={(v) =>
                      patch(
                        { op: 'set_logs_channel', channel_id: v === '' ? null : v },
                        'logs'
                      )
                    }
                  />
                </div>
              </div>
            </div>

            <div className="an-module enabled" style={{ animationDelay: '0.08s' }}>
              <div className="an-module-header">
                <span className="an-module-name">New ticket channel name</span>
              </div>
              <span className="an-module-desc">
                Template for new ticket channel names. Variables such as{' '}
                <span className="ticket-cmd">{'{user.name}'}</span> are supported. Leave empty for the default{' '}
                <span className="ticket-cmd">ticket-username</span> pattern.
              </span>
              <div className="an-module-body">
                <div className="an-edit-field">
                  <label>Template</label>
                  <input
                    type="text"
                    className="settings-input"
                    value={channelNameDraft}
                    onChange={(e) => setChannelNameDraft(e.target.value)}
                    placeholder="ticket-{user.name}"
                    disabled={!!saving}
                  />
                </div>
                <div className="settings-input-row">
                  <button
                    type="button"
                    className="settings-save-btn"
                    disabled={saving === 'chname'}
                    onClick={() =>
                      patch(
                        {
                          op: 'set_channel_name',
                          channel_name:
                            channelNameDraft.trim() === '' ? null : channelNameDraft.trim(),
                        },
                        'chname'
                      )
                    }
                  >
                    {saving === 'chname' ? 'Saving…' : 'Save template'}
                  </button>
                </div>
              </div>
            </div>

            <div className="an-module enabled" style={{ animationDelay: '0.1s' }}>
              <div className="an-module-header">
                <span className="an-module-name">
                  Staff roles
                  {data.config.staff_ids.length > 0
                    ? ` (${data.config.staff_ids.length})`
                    : ''}
                </span>
              </div>
              <span className="an-module-desc">
                Roles that can view new tickets and close them (in addition to Manage Channels).
              </span>
              <div className="an-module-body">
                <div className="an-edit-field">
                  <label>Add role</label>
                  <div className="settings-input-row">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <RoleDropdown
                        roles={roles.filter(
                          (r) => !r.managed && !data.config!.staff_ids.includes(r.id)
                        )}
                        value={staffRoleDraft}
                        onChange={setStaffRoleDraft}
                        placeholder="Select a role"
                      />
                    </div>
                    <button
                      type="button"
                      className="settings-save-btn"
                      disabled={!staffRoleDraft || saving === 'staff-add'}
                      onClick={() => {
                        const id = staffRoleDraft
                        patch({ op: 'add_staff', role_id: id }, 'staff-add').then((ok) => {
                          if (ok) setStaffRoleDraft('')
                        })
                      }}
                    >
                      {saving === 'staff-add' ? 'Adding…' : 'Add'}
                    </button>
                  </div>
                </div>
                {data.config.staff_ids.length === 0 ? (
                  <p className="settings-hint" style={{ margin: 0 }}>
                    No staff roles yet.
                  </p>
                ) : (
                  <div className="ticket-list">
                    {data.config.staff_ids.map((rid) => {
                      const role = rolesById.get(rid)
                      const hex = role ? colorHex(role.color) : null
                      return (
                        <div key={rid} className="ticket-row">
                          <span className="ticket-row-main">
                            <span
                              className="ticket-role-dot"
                              style={hex ? { background: hex } : undefined}
                            />
                            <span className="ticket-row-label">
                              {role ? role.name : `Unknown role · ${rid}`}
                            </span>
                          </span>
                          <button
                            type="button"
                            className="autorole-remove-btn"
                            disabled={saving === `staff-${rid}`}
                            onClick={() => patch({ op: 'remove_staff', role_id: rid }, `staff-${rid}`)}
                            aria-label={`Remove staff role ${role ? role.name : rid}`}
                            title="Remove"
                          >
                            {saving === `staff-${rid}` ? '…' : '-'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="an-module enabled" style={{ animationDelay: '0.12s' }}>
              <div className="an-module-header">
                <span className="an-module-name">
                  Blocklist
                  {data.config.blacklisted_ids.length > 0
                    ? ` (${data.config.blacklisted_ids.length})`
                    : ''}
                </span>
              </div>
              <span className="an-module-desc">
                User or role IDs that cannot open tickets.
              </span>
              <div className="an-module-body">
                <div className="an-edit-field">
                  <label>User or role ID</label>
                  <div className="settings-input-row">
                    <input
                      type="text"
                      className="settings-input"
                      inputMode="numeric"
                      placeholder="17–20 digit ID"
                      value={blacklistDraft}
                      onChange={(e) => setBlacklistDraft(e.target.value.replace(/\D/g, ''))}
                      disabled={!!saving}
                    />
                    <button
                      type="button"
                      className="settings-save-btn"
                      disabled={!blacklistDraft || saving === 'bl-add'}
                      onClick={() => {
                        patch({ op: 'add_blacklist', target_id: blacklistDraft }, 'bl-add').then(
                          (ok) => {
                            if (ok) setBlacklistDraft('')
                          }
                        )
                      }}
                    >
                      {saving === 'bl-add' ? 'Adding…' : 'Block'}
                    </button>
                  </div>
                </div>
                {data.config.blacklisted_ids.length === 0 ? (
                  <p className="settings-hint" style={{ margin: 0 }}>
                    Nobody is blocked.
                  </p>
                ) : (
                  <div className="ticket-list">
                    {data.config.blacklisted_ids.map((tid) => (
                      <div key={tid} className="ticket-row">
                        <span className="ticket-row-code">{tid}</span>
                        <button
                          type="button"
                          className="autorole-remove-btn"
                          disabled={saving === `bl-${tid}`}
                          onClick={() =>
                            patch({ op: 'remove_blacklist', target_id: tid }, `bl-${tid}`)
                          }
                          aria-label={`Unblock ${tid}`}
                          title="Unblock"
                        >
                          {saving === `bl-${tid}` ? '…' : '-'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {data.buttons.length === 0 && (
              <div className="an-module" style={{ animationDelay: '0.14s' }}>
                <div className="an-module-header">
                  <span className="an-module-name">Ticket buttons</span>
                </div>
                <span className="an-module-desc">
                  No buttons yet. Add one with{' '}
                  <span className="ticket-cmd">;ticket button add</span> in Discord.
                </span>
              </div>
            )}

            {data.buttons.map((btn, i) => {
              const draft = buttonDrafts[btn.identifier] ?? {
                template: btn.template ?? '',
                category_id: btn.category_id ?? '',
              }
              return (
                <div
                  key={btn.identifier}
                  className="an-module enabled"
                  style={{ animationDelay: `${0.14 + i * 0.02}s` }}
                >
                  <div className="an-module-header">
                    <span className="an-module-name">Button · {btn.identifier}</span>
                    <button
                      type="button"
                      className="system-messages-icon-btn system-messages-minus-btn"
                      disabled={saving === `del-btn-${btn.identifier}`}
                      onClick={() => handleDeleteButton(btn.identifier)}
                      aria-label={`Delete ticket button ${btn.identifier}`}
                      title="Delete"
                    >
                      {saving === `del-btn-${btn.identifier}` ? '…' : '-'}
                    </button>
                  </div>
                  <span className="an-module-desc">
                    Welcome message when a ticket opens from this button. Category controls where
                    new channels are created.
                  </span>
                  <div className="an-module-body">
                    <div className="an-edit-field">
                      <label>Category</label>
                      <Dropdown
                        value={draft.category_id}
                        placeholder="Select a category"
                        saving={saving === `cat-${btn.identifier}`}
                        options={[
                          { value: '', label: 'Guild root (no category)' },
                          ...categories.map((c) => ({ value: c.id, label: c.name })),
                        ]}
                        onChange={(v) =>
                          setButtonDrafts((prev) => ({
                            ...prev,
                            [btn.identifier]: { ...draft, category_id: v },
                          }))
                        }
                      />
                      <div className="ticket-button-footer">
                        <button
                          type="button"
                          className="settings-save-btn"
                          disabled={saving === `cat-${btn.identifier}`}
                          onClick={() =>
                            patch(
                              {
                                op: 'set_button_category',
                                identifier: btn.identifier,
                                category_id: draft.category_id === '' ? null : draft.category_id,
                              },
                              `cat-${btn.identifier}`
                            )
                          }
                        >
                          {saving === `cat-${btn.identifier}` ? 'Saving…' : 'Save category'}
                        </button>
                      </div>
                    </div>
                    <div className="an-edit-field">
                      <label>Welcome message</label>
                      <textarea
                        className="settings-input"
                        value={draft.template}
                        disabled={!!saving}
                        onChange={(e) =>
                          setButtonDrafts((prev) => ({
                            ...prev,
                            [btn.identifier]: { ...draft, template: e.target.value },
                          }))
                        }
                        placeholder="Message sent when the ticket opens…"
                      />
                      <div className="ticket-button-footer">
                        <button
                          type="button"
                          className="settings-save-btn"
                          disabled={saving === `tpl-${btn.identifier}`}
                          onClick={() =>
                            patch(
                              {
                                op: 'set_button_template',
                                identifier: btn.identifier,
                                template: draft.template.trim() === '' ? null : draft.template,
                              },
                              `tpl-${btn.identifier}`
                            )
                          }
                        >
                          {saving === `tpl-${btn.identifier}` ? 'Saving…' : 'Save message'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </>
        )}
      </div>
      {confirmModal}
    </>
  )
}
