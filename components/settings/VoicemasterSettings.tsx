'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useConfirm } from '@elira/components/shared/confirm-modal'
import { ChannelDropdown, Dropdown, RoleDropdown } from '@/components/settings/AnDropdowns'
import { fetchBundle } from '@/lib/bundle-client'
import {
  isDiscordCategoryChannel,
  isDiscordTextChannel,
  isDiscordVoiceChannel,
} from '@/lib/guild/channel-type'
import type { GuildChannel, GuildRole } from '@/components/settings/types'
import {
  REGIONS,
  MIN_BITRATE_KBPS as MIN_BITRATE,
  MAX_BITRATE_KBPS as MAX_BITRATE,
  type EnrichedVoicemasterChannel as VmChannel,
  type VoicemasterConfiguration as Configuration,
} from '@/lib/settings/voicemaster-types'

const REGION_LABELS: Record<string, string> = {
  brazil: 'Brazil',
  hongkong: 'Hong Kong',
  india: 'India',
  japan: 'Japan',
  rotterdam: 'Rotterdam',
  russia: 'Russia',
  singapore: 'Singapore',
  'south-korea': 'South Korea',
  southafrica: 'South Africa',
  sydney: 'Sydney',
  'us-central': 'US Central',
  'us-east': 'US East',
  'us-south': 'US South',
  'us-west': 'US West',
}

export default function VoicemasterSettings({ guildId }: { guildId: string }) {
  const [configuration, setConfiguration] = useState<Configuration | null>(null)
  const [channels, setChannels] = useState<VmChannel[]>([])
  const [categories, setCategories] = useState<GuildChannel[]>([])
  const [voiceChannels, setVoiceChannels] = useState<GuildChannel[]>([])
  const [textChannels, setTextChannels] = useState<GuildChannel[]>([])
  const [roles, setRoles] = useState<GuildRole[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [bitrateDraft, setBitrateDraft] = useState<string>('')
  const [customChannelDraft, setCustomChannelDraft] = useState<string>('')
  const { confirm, modal: confirmModal } = useConfirm()

  useEffect(() => {
    let cancelled = false
    fetchBundle(guildId, [
      'voicemaster',
      'voicemaster_channels',
      'channels',
      'roles',
    ])
      .then((bundle) => {
        if (cancelled) return
        const config = (bundle.voicemaster?.configuration ?? null) as Configuration | null
        setConfiguration(config)
        setBitrateDraft(config?.bitrate ? String(Math.round(config.bitrate / 1000)) : '')
        const vmChannels = bundle.voicemaster_channels?.channels
        if (Array.isArray(vmChannels)) setChannels(vmChannels as VmChannel[])
        const all = Array.isArray(bundle.channels)
          ? (bundle.channels as GuildChannel[])
          : []
        setCategories(all.filter((c) => isDiscordCategoryChannel(c)))
        setVoiceChannels(all.filter((c) => isDiscordVoiceChannel(c)))
        setTextChannels(all.filter((c) => isDiscordTextChannel(c)))
        if (Array.isArray(bundle.roles)) setRoles(bundle.roles as GuildRole[])
      })
      .catch(() => {
        if (cancelled) return
        setError('Failed to load voicemaster settings')
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [guildId])

  const refreshActiveChannels = useCallback(async () => {
    try {
      const res = await fetch(`/api/guilds/${guildId}/voicemaster/channels`, {
        credentials: 'same-origin',
        cache: 'no-store',
      })
      if (!res.ok) return
      const data = await res.json()
      if (Array.isArray(data.channels)) setChannels(data.channels as VmChannel[])
    } catch {
      /* ignore background refresh errors */
    }
  }, [guildId])

  useEffect(() => {
    if (!configuration) return
    const interval = window.setInterval(refreshActiveChannels, 5000)
    const onFocus = () => {
      void refreshActiveChannels()
    }
    window.addEventListener('focus', onFocus)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', onFocus)
    }
  }, [configuration, refreshActiveChannels])

  const channelsById = useMemo(() => {
    const map = new Map<string, GuildChannel>()
    for (const c of [...categories, ...voiceChannels, ...textChannels]) {
      map.set(String(c.id).trim(), c)
    }
    return map
  }, [categories, voiceChannels, textChannels])

  const rolesById = useMemo(() => {
    const map = new Map<string, GuildRole>()
    for (const r of roles) map.set(r.id, r)
    return map
  }, [roles])

  const patch = async (
    body: Record<string, unknown>,
    savingKey: string
  ): Promise<boolean> => {
    setSaving(savingKey)
    setError(null)
    try {
      const res = await fetch(`/api/guilds/${guildId}/voicemaster`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to save')
        return false
      }
      setConfiguration(data.configuration ?? null)
      if (data.configuration?.bitrate != null) {
        setBitrateDraft(String(Math.round(data.configuration.bitrate / 1000)))
      } else if ('bitrate' in body) {
        setBitrateDraft('')
      }
      return true
    } catch {
      setError('Failed to save')
      return false
    } finally {
      setSaving(null)
    }
  }

  const handleReset = async () => {
    const ok = await confirm({
      title: 'Reset VoiceMaster?',
      description:
        'This wipes the configuration for this server. Existing temporary channels will be left in place but no longer tracked, and you will need to run the setup command again.',
      confirmLabel: 'Reset configuration',
      cancelLabel: 'Cancel',
      destructive: true,
    })
    if (!ok) return
    setSaving('reset')
    setError(null)
    try {
      const res = await fetch(`/api/guilds/${guildId}/voicemaster`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Failed to reset')
        return
      }
      setConfiguration(null)
      setBitrateDraft('')
      const ch = await fetch(`/api/guilds/${guildId}/voicemaster/channels`).then((r) => r.json())
      if (Array.isArray(ch?.channels)) setChannels(ch.channels)
    } catch {
      setError('Failed to reset')
    } finally {
      setSaving(null)
    }
  }

  const handleDisconnectMember = async (
    channelId: string,
    userId: string,
    memberLabel: string
  ) => {
    const ok = await confirm({
      title: 'Disconnect member?',
      description: `Remove ${memberLabel} from this voice channel? They will be disconnected from the call.`,
      confirmLabel: 'Disconnect',
      cancelLabel: 'Cancel',
      destructive: true,
    })
    if (!ok) return

    const key = `disconnect:${channelId}:${userId}`
    setSaving(key)
    setError(null)
    try {
      const res = await fetch(
        `/api/guilds/${guildId}/voicemaster/channels/disconnect`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channel_id: channelId, user_ids: [userId] }),
        }
      )
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to disconnect member')
        return
      }
      if (Array.isArray(data.failed_user_ids) && data.failed_user_ids.length > 0) {
        setError('Member could not be disconnected (they may have already left).')
      }
      if (Array.isArray(data.channels)) setChannels(data.channels as VmChannel[])
      else void refreshActiveChannels()
    } catch {
      setError('Failed to disconnect member')
    } finally {
      setSaving(null)
    }
  }

  const handleDeleteChannel = async (channelId: string) => {
    const ok = await confirm({
      title: 'Delete this voice channel?',
      description:
        'Everyone currently inside will be disconnected and the channel will be removed from Discord. This cannot be undone.',
      confirmLabel: 'Delete channel',
      cancelLabel: 'Cancel',
      destructive: true,
    })
    if (!ok) return

    setSaving(`channel:${channelId}`)
    setError(null)
    try {
      const res = await fetch(`/api/guilds/${guildId}/voicemaster/channels`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel_id: channelId, mode: 'hard' }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to delete')
        return
      }
      if (data.warning) setError(data.warning)
      if (Array.isArray(data.channels)) setChannels(data.channels as VmChannel[])
      else void refreshActiveChannels()
    } catch {
      setError('Failed to delete')
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return <div className="settings-loading">Loading...</div>
  }

  if (!configuration) {
    return (
      <>
      <div className="autorole-settings voicemaster-settings">
        {error && <p className="settings-error">{error}</p>}
        <div className="an-module" style={{ animationDelay: '0.03s' }}>
          <div className="an-module-header">
            <span className="an-module-name">VoiceMaster is not set up</span>
          </div>
          <span className="an-module-desc">
            Run <code>voicemaster setup</code> in your server to create the join-to-create
            channel and interface. Once configured, you&apos;ll be able to manage the defaults
            here.
          </span>
        </div>
      </div>
      {confirmModal}
      </>
    )
  }

  const categoryName = configuration.category_id
    ? channelsById.get(String(configuration.category_id).trim())?.name
    : null
  const joinToCreateName = configuration.channel_id
    ? channelsById.get(String(configuration.channel_id).trim())?.name
    : null
  const defaultRole = configuration.role_id
    ? rolesById.get(configuration.role_id)
    : null
  const bitrateKbps = configuration.bitrate != null
    ? Math.round(configuration.bitrate / 1000)
    : null
  const parsedBitrate = bitrateDraft.trim() === '' ? null : Number(bitrateDraft)
  const bitrateChanged = parsedBitrate !== bitrateKbps
  const bitrateValid =
    parsedBitrate === null ||
    (Number.isFinite(parsedBitrate) && parsedBitrate >= MIN_BITRATE && parsedBitrate <= MAX_BITRATE)

  return (
    <>
    <div className="autorole-settings voicemaster-settings">
      {error && <p className="settings-error">{error}</p>}

      <div className="an-module enabled" style={{ animationDelay: '0.03s' }}>
        <div className="an-module-header">
          <span className="an-module-name">Join-to-create channel</span>
        </div>
        <span className="an-module-desc">
          When a member joins this voice channel, a personal temporary channel is created for them
          in the configured category.
        </span>
        <div className="an-module-body">
          <div className="an-edit-field">
            <label>{joinToCreateName ? `Currently: ${joinToCreateName}` : 'Pick a voice channel'}</label>
            <ChannelDropdown
              channels={voiceChannels}
              categories={categories}
              value={configuration.channel_id ?? ''}
              onChange={(id) => id && patch({ channel_id: id }, 'channel')}
              placeholder="Select a voice channel"
              saving={saving === 'channel'}
              prefix=""
            />
          </div>
          <div className="an-edit-field">
            <label>Or enter a channel id</label>
            <div className="settings-input-row">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                className="settings-input"
                value={customChannelDraft}
                onChange={(e) =>
                  setCustomChannelDraft(e.target.value.replace(/[^0-9]/g, ''))
                }
                placeholder="e.g. 1234567890123456789"
                maxLength={20}
              />
              <button
                className="settings-save-btn"
                disabled={
                  saving === 'channel-custom' ||
                  customChannelDraft.length < 17 ||
                  customChannelDraft.length > 20 ||
                  customChannelDraft === configuration.channel_id
                }
                onClick={async () => {
                  const ok = await patch(
                    { channel_id: customChannelDraft },
                    'channel-custom'
                  )
                  if (ok) setCustomChannelDraft('')
                }}
              >
                {saving === 'channel-custom' ? 'Saving...' : 'Apply'}
              </button>
            </div>
            {customChannelDraft.length > 0 &&
              (customChannelDraft.length < 17 || customChannelDraft.length > 20) && (
                <p className="settings-hint">Channel ids are 17–20 digits</p>
              )}
          </div>
          <div className="an-edit-field">
            <label>Interface channel</label>
            <div className="settings-input-row">
              <input
                type="text"
                className="settings-input"
                value={
                  configuration.interface_id
                    ? (() => {
                        const ch = channelsById.get(configuration.interface_id)
                        return ch ? `#${ch.name}` : configuration.interface_id
                      })()
                    : '—'
                }
                disabled
              />
            </div>
          </div>
        </div>
      </div>

      <div className="an-module enabled" style={{ animationDelay: '0.06s' }}>
        <div className="an-module-header">
          <span className="an-module-name">Category</span>
        </div>
        <span className="an-module-desc">
          The category that newly created VoiceMaster channels are placed in.
        </span>
        <div className="an-module-body">
          <div className="an-edit-field">
            <label>{categoryName ? `Currently: ${categoryName}` : 'Pick a category'}</label>
            <ChannelDropdown
              channels={categories}
              value={configuration.category_id ?? ''}
              onChange={(id) => patch({ category_id: id || null }, 'category')}
              placeholder="Select a category"
              saving={saving === 'category'}
              prefix=""
            />
          </div>
        </div>
      </div>

      <div className="an-module enabled" style={{ animationDelay: '0.09s' }}>
        <div className="an-module-header">
          <span className="an-module-name">Default role</span>
          {configuration.role_id && (
            <button
              className="an-toggle-btn"
              onClick={() => patch({ role_id: null }, 'role-clear')}
              disabled={saving === 'role-clear'}
            >
              {saving === 'role-clear' ? 'Removing...' : 'Remove'}
            </button>
          )}
        </div>
        <span className="an-module-desc">
          Role automatically assigned to members while they are inside a VoiceMaster channel.
          Removed when they leave.
        </span>
        <div className="an-module-body">
          <div className="an-edit-field">
            <label>{defaultRole ? `Currently: ${defaultRole.name}` : 'Pick a role'}</label>
            <RoleDropdown
              roles={roles.filter((r) => !r.managed)}
              value={configuration.role_id ?? ''}
              onChange={(id) => patch({ role_id: id || null }, 'role')}
              saving={saving === 'role'}
              placeholder="Select a role"
            />
          </div>
        </div>
      </div>

      <div className="an-module enabled" style={{ animationDelay: '0.12s' }}>
        <div className="an-module-header">
          <span className="an-module-name">Default region</span>
          {configuration.region && (
            <button
              className="an-toggle-btn"
              onClick={() => patch({ region: null }, 'region-clear')}
              disabled={saving === 'region-clear'}
            >
              {saving === 'region-clear' ? 'Clearing...' : 'Auto'}
            </button>
          )}
        </div>
        <span className="an-module-desc">
          Voice region used when creating new channels. Leave on auto to let Discord pick the
          best region.
        </span>
        <div className="an-module-body">
          <div className="an-edit-field">
            <label>
              {configuration.region
                ? `Currently: ${REGION_LABELS[configuration.region] ?? configuration.region}`
                : 'Currently: Auto'}
            </label>
            <Dropdown
              value={configuration.region ?? ''}
              options={[
                { value: '', label: 'Auto (recommended)' },
                ...REGIONS.map((r) => ({ value: r, label: REGION_LABELS[r] ?? r })),
              ]}
              onChange={(v) => patch({ region: v || null }, 'region')}
              saving={saving === 'region'}
            />
          </div>
        </div>
      </div>

      <div className="an-module enabled" style={{ animationDelay: '0.15s' }}>
        <div className="an-module-header">
          <span className="an-module-name">Default bitrate</span>
          {configuration.bitrate != null && (
            <button
              className="an-toggle-btn"
              onClick={() => patch({ bitrate: null }, 'bitrate-clear')}
              disabled={saving === 'bitrate-clear'}
            >
              {saving === 'bitrate-clear' ? 'Clearing...' : 'Default'}
            </button>
          )}
        </div>
        <span className="an-module-desc">
          Bitrate in kbps used when creating new channels (between {MIN_BITRATE} and {MAX_BITRATE}).
          Leave blank to use the server&apos;s default.
        </span>
        <div className="an-module-body">
          <div className="an-edit-field">
            <label>kbps</label>
            <div className="settings-input-row">
              <input
                type="number"
                className="settings-input"
                min={MIN_BITRATE}
                max={MAX_BITRATE}
                value={bitrateDraft}
                onChange={(e) => setBitrateDraft(e.target.value)}
                placeholder="e.g. 64"
              />
              <button
                className="settings-save-btn"
                onClick={() =>
                  patch({ bitrate: parsedBitrate }, 'bitrate')
                }
                disabled={saving === 'bitrate' || !bitrateChanged || !bitrateValid}
              >
                {saving === 'bitrate' ? 'Saving...' : 'Save'}
              </button>
            </div>
            {!bitrateValid && (
              <p className="settings-error">
                Bitrate must be between {MIN_BITRATE} and {MAX_BITRATE} kbps
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="an-module enabled" style={{ animationDelay: '0.18s' }}>
        <div className="an-module-header">
          <span className="an-module-name">
            Active channels{channels.length > 0 ? ` (${channels.length})` : ''}
          </span>
        </div>
        <span className="an-module-desc">
          Temporary voice channels active on this server. Delete one to disconnect everyone inside
          and remove it from Discord. If it was already deleted in Discord, delete it here to remove
          it from this list.
        </span>
        <div className="an-module-body">
          {channels.length === 0 ? (
            <p className="settings-hint" style={{ margin: 0 }}>
              No active VoiceMaster channels right now.
            </p>
          ) : (
            <ul className="an-access-chips vm-active-channels">
              {channels.map((ch) => {
                const channelKey = String(ch.channel_id).trim()
                const guildChannel = channelsById.get(channelKey)
                const channelName = ch.name ?? guildChannel?.name ?? null
                const channelExists = ch.exists || !!guildChannel
                const channelPrimary =
                  channelName ??
                  (channelExists ? 'Voice channel' : 'Temporary voice channel')
                const key = `channel:${ch.channel_id}`
                const busy = saving === key
                const ownerHandle = ch.owner_username?.trim() || ''
                const ownerDisplay = ch.owner_display_name?.trim() || ''
                const ownerPrimary =
                  ownerDisplay ||
                  ownerHandle ||
                  (ch.owner_id ? 'Unknown member' : 'No owner')
                const ownerSecondary = ch.owner_id
                  ? ownerHandle
                    ? `@${ownerHandle} · ${ch.owner_id}`
                    : `Member · ${ch.owner_id}`
                  : null
                const ownerInitial = (
                  ownerDisplay[0] || ownerHandle[0] || ch.owner_id?.[0] || '?'
                ).toUpperCase()

                const statParts: string[] = []
                if (channelExists) {
                  if (ch.member_count != null) {
                    statParts.push(
                      `${ch.member_count} connected${ch.user_limit ? ` (max ${ch.user_limit})` : ''}`
                    )
                  }
                  if (ch.bitrate != null) {
                    statParts.push(`${Math.round(ch.bitrate / 1000)} kbps`)
                  }
                }

                return (
                  <li
                    key={ch.channel_id}
                    className={`an-access-chip vm-active-channel-chip${
                      !channelExists ? ' vm-active-channel-chip--stale' : ''
                    }`}
                  >
                    <div className="vm-active-channel-chip-body">
                      <div className="vm-active-channel-chip-head">
                        <div className="vm-active-channel-chip-title-wrap">
                          <div className="an-access-chip-text">
                            <span className="an-access-chip-name">{channelPrimary}</span>
                            <span className="an-access-chip-id" title="Channel ID">
                              {ch.channel_id}
                            </span>
                          </div>
                          {!channelExists && (
                            <span className="vm-active-channel-badge">Not in Discord</span>
                          )}
                        </div>
                        <button
                          type="button"
                          className="disabled-commands-clear-all"
                          onClick={() => handleDeleteChannel(ch.channel_id)}
                          disabled={busy}
                          aria-label={
                            channelExists
                              ? `Delete voice channel ${channelPrimary}`
                              : `Remove channel ${ch.channel_id} from list`
                          }
                          title={
                            channelExists
                              ? 'Disconnect members and delete the voice channel'
                              : 'Remove from list'
                          }
                        >
                          -
                        </button>
                      </div>
                      {statParts.length > 0 && (
                        <span className="vm-active-channel-chip-meta">{statParts.join(' · ')}</span>
                      )}
                      {!channelExists && (
                        <p className="vm-active-channel-chip-stale-hint">
                          Not visible in this server — remove to clear it from this list.
                        </p>
                      )}
                      {ch.owner_id ? (
                        <div className="an-access-chip-main vm-active-channel-owner">
                          {ch.owner_avatar ? (
                            <img
                              src={ch.owner_avatar}
                              alt=""
                              className="an-access-chip-avatar"
                            />
                          ) : (
                            <div
                              className="an-access-chip-avatar an-access-chip-avatar-placeholder"
                              aria-hidden
                            >
                              {ownerInitial}
                            </div>
                          )}
                          <div className="an-access-chip-text">
                            <span className="an-access-chip-name">{ownerPrimary}</span>
                            {ownerSecondary ? (
                              <span className="an-access-chip-id">{ownerSecondary}</span>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                      {channelExists &&
                      Array.isArray(ch.connected_members) &&
                      ch.connected_members.length > 0 ? (
                        <div className="vm-connected-members">
                          <span className="vm-connected-members-label">In call</span>
                          <ul className="an-access-chips vm-connected-member-chips">
                            {ch.connected_members.map((member) => {
                              const uid = String(member.user_id).trim()
                              const handle = member.username?.trim() || ''
                              const display = member.display_name?.trim() || ''
                              const memberPrimary =
                                display || handle || 'Unknown member'
                              const memberSecondary = handle
                                ? `@${handle} · ${uid}`
                                : `Member · ${uid}`
                              const memberInitial = (
                                display[0] || handle[0] || uid[0] || '?'
                              ).toUpperCase()
                              const disconnectKey = `disconnect:${ch.channel_id}:${uid}`
                              const disconnectBusy = saving === disconnectKey

                              return (
                                <li key={uid} className="an-access-chip vm-connected-member-chip">
                                  <div className="an-access-chip-main">
                                    {member.avatar ? (
                                      <img
                                        src={member.avatar}
                                        alt=""
                                        className="an-access-chip-avatar"
                                      />
                                    ) : (
                                      <div
                                        className="an-access-chip-avatar an-access-chip-avatar-placeholder"
                                        aria-hidden
                                      >
                                        {memberInitial}
                                      </div>
                                    )}
                                    <div className="an-access-chip-text">
                                      <span className="an-access-chip-name">{memberPrimary}</span>
                                      <span className="an-access-chip-id">{memberSecondary}</span>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    className="disabled-commands-clear-all"
                                    onClick={() =>
                                      handleDisconnectMember(
                                        ch.channel_id,
                                        uid,
                                        memberPrimary
                                      )
                                    }
                                    disabled={disconnectBusy}
                                    aria-label={`Disconnect ${memberPrimary} from ${channelPrimary}`}
                                    title="Disconnect from voice channel"
                                  >
                                    -
                                  </button>
                                </li>
                              )
                            })}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="an-module" style={{ animationDelay: '0.21s' }}>
        <div className="an-module-header">
          <span className="an-module-name">Reset configuration</span>
          <button
            className="autorole-remove-btn"
            onClick={handleReset}
            disabled={saving === 'reset'}
          >
            {saving === 'reset' ? 'Resetting...' : 'Reset'}
          </button>
        </div>
        <span className="an-module-desc">
          Remove the VoiceMaster configuration entirely. You&apos;ll need to run{' '}
          <code>voicemaster setup</code> again to reconfigure.
        </span>
      </div>
    </div>
    {confirmModal}
    </>
  )
}
