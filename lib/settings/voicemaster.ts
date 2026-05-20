import pool from '@elira/lib/infra/db'
import redis from '@elira/lib/infra/redis'
import {
  CLUSTER_API_BASE,
  fetchGuildChannels,
  invalidateGuildChannelsCache,
  type GuildChannel,
} from '@elira/lib/cluster/client'
import { fetchUserInfoBatch } from '@elira/lib/cluster/fetch-users'
import {
  REGIONS,
  MIN_BITRATE_KBPS,
  MAX_BITRATE_KBPS,
  type Region,
  type VoicemasterConfiguration,
  type VoicemasterChannel,
  type EnrichedVoicemasterChannel,
  type VoicemasterConnectedMember,
} from '@/lib/settings/voicemaster-types'

export type {
  Region,
  VoicemasterConfiguration,
  VoicemasterChannel,
  EnrichedVoicemasterChannel,
  VoicemasterConnectedMember,
}

function clusterJsonParse<T>(text: string): T {
  const safe = text.replace(/"(id|guild_id|owner_id)":\s*(\d{15,})/g, '"$1":"$2"')
  return JSON.parse(safe) as T
}

function configCacheKey(guildId: string): string {
  return `voicemaster:config:${guildId}`
}

function channelCacheKey(channelId: string): string {
  return `voicemaster:channel:${channelId}`
}

async function invalidateConfigCache(guildId: string): Promise<void> {
  await redis.del(configCacheKey(guildId))
}

async function invalidateChannelCache(channelId: string): Promise<void> {
  await redis.del(channelCacheKey(channelId))
}

function rowToConfiguration(row: Record<string, unknown>): VoicemasterConfiguration {
  return {
    guild_id: String(row.guild_id),
    category_id: row.category_id == null ? null : String(row.category_id),
    interface_id: row.interface_id == null ? null : String(row.interface_id),
    channel_id: row.channel_id == null ? null : String(row.channel_id),
    role_id: row.role_id == null ? null : String(row.role_id),
    region: (row.region as Region | null) ?? null,
    bitrate: row.bitrate == null ? null : Number(row.bitrate),
    interface_layout: (row.interface_layout as string) ?? 'default',
  }
}

function rowToChannel(row: Record<string, unknown>): VoicemasterChannel {
  return {
    guild_id: String(row.guild_id),
    channel_id: String(row.channel_id),
    owner_id: row.owner_id == null ? null : String(row.owner_id),
  }
}

export async function getConfiguration(
  guildId: string
): Promise<VoicemasterConfiguration | null> {
  const res = await pool.query(
    `SELECT * FROM voicemaster.configuration WHERE guild_id = $1`,
    [guildId]
  )

  if (res.rows.length === 0) return null
  return rowToConfiguration(res.rows[0])
}

export async function createConfiguration(
  guildId: string,
  categoryId: string,
  interfaceId: string,
  channelId: string
): Promise<VoicemasterConfiguration> {
  const res = await pool.query(
    `INSERT INTO voicemaster.configuration (guild_id, category_id, interface_id, channel_id)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [guildId, categoryId, interfaceId, channelId]
  )

  await invalidateConfigCache(guildId)
  return rowToConfiguration(res.rows[0])
}

export interface DeletedConfiguration {
  category_id: string | null
  interface_id: string | null
  channel_id: string | null
}

export async function deleteConfiguration(
  guildId: string
): Promise<DeletedConfiguration | null> {
  const res = await pool.query(
    `DELETE FROM voicemaster.configuration
     WHERE guild_id = $1
     RETURNING category_id, interface_id, channel_id`,
    [guildId]
  )

  await invalidateConfigCache(guildId)

  if (res.rows.length === 0) return null
  const row = res.rows[0]
  return {
    category_id: row.category_id == null ? null : String(row.category_id),
    interface_id: row.interface_id == null ? null : String(row.interface_id),
    channel_id: row.channel_id == null ? null : String(row.channel_id),
  }
}

async function ensureConfigured(guildId: string): Promise<void> {
  const existing = await pool.query(
    `SELECT 1 FROM voicemaster.configuration WHERE guild_id = $1 LIMIT 1`,
    [guildId]
  )
  if (existing.rows.length === 0) {
    throw new Error('VoiceMaster is not configured for this server')
  }
}

export async function updateCategory(
  guildId: string,
  categoryId: string | null
): Promise<void> {
  await ensureConfigured(guildId)
  await pool.query(
    `UPDATE voicemaster.configuration SET category_id = $2 WHERE guild_id = $1`,
    [guildId, categoryId]
  )
  await invalidateConfigCache(guildId)
}

export async function updateChannel(
  guildId: string,
  channelId: string
): Promise<void> {
  await ensureConfigured(guildId)
  await pool.query(
    `UPDATE voicemaster.configuration SET channel_id = $2 WHERE guild_id = $1`,
    [guildId, channelId]
  )
  await invalidateConfigCache(guildId)
}

export async function updateRole(
  guildId: string,
  roleId: string | null
): Promise<void> {
  await ensureConfigured(guildId)
  await pool.query(
    `UPDATE voicemaster.configuration SET role_id = $2 WHERE guild_id = $1`,
    [guildId, roleId]
  )
  await invalidateConfigCache(guildId)
}

export async function updateRegion(
  guildId: string,
  region: Region | null
): Promise<void> {
  if (region !== null && !REGIONS.includes(region)) {
    throw new Error(`Region must be one of: ${REGIONS.join(', ')}`)
  }
  await ensureConfigured(guildId)
  await pool.query(
    `UPDATE voicemaster.configuration SET region = $2 WHERE guild_id = $1`,
    [guildId, region]
  )
  await invalidateConfigCache(guildId)
}

export async function updateBitrate(
  guildId: string,
  bitrateKbps: number | null
): Promise<void> {
  if (bitrateKbps !== null) {
    if (!Number.isFinite(bitrateKbps)) {
      throw new Error('Bitrate must be a number')
    }
    if (bitrateKbps < MIN_BITRATE_KBPS || bitrateKbps > MAX_BITRATE_KBPS) {
      throw new Error(
        `Bitrate must be between ${MIN_BITRATE_KBPS} and ${MAX_BITRATE_KBPS} kbps`
      )
    }
  }
  await ensureConfigured(guildId)
  await pool.query(
    `UPDATE voicemaster.configuration SET bitrate = $2 WHERE guild_id = $1`,
    [guildId, bitrateKbps == null ? null : bitrateKbps * 1000]  
  )
  await invalidateConfigCache(guildId)
}

async function getChannels(guildId: string): Promise<VoicemasterChannel[]> {
  const res = await pool.query(
    `SELECT guild_id, channel_id, owner_id
     FROM voicemaster.channels
     WHERE guild_id = $1
     ORDER BY channel_id`,
    [guildId]
  )
  return res.rows.map(rowToChannel)
}

function voiceChannelOccupancy(ch: GuildChannel | undefined): number | null {
  if (!ch) return null
  if (typeof ch.member_count === 'number' && !Number.isNaN(ch.member_count)) {
    return ch.member_count
  }
  const ids = ch.connected_member_ids
  if (Array.isArray(ids)) return ids.length
  return 0
}

/** Drop dashboard entries for channels gone from Discord or with nobody connected. */
async function pruneInactiveVoicemasterChannels(
  _guildId: string,
  base: VoicemasterChannel[],
  live: GuildChannel[]
): Promise<VoicemasterChannel[]> {
  const liveById = new Map(live.map((c) => [String(c.id).trim(), c] as const))
  const removeIds: string[] = []
  for (const row of base) {
    const id = String(row.channel_id).trim()
    const ch = liveById.get(id)
    const occupancy = voiceChannelOccupancy(ch)
    if (occupancy === null || occupancy === 0) {
      removeIds.push(id)
    }
  }
  if (removeIds.length > 0) {
    await deleteChannels(removeIds)
  }
  const removed = new Set(removeIds)
  return base.filter((row) => !removed.has(String(row.channel_id).trim()))
}

export async function getEnrichedChannels(
  guildId: string
): Promise<EnrichedVoicemasterChannel[]> {
  await invalidateGuildChannelsCache(guildId)
  let base = await getChannels(guildId)
  let live: GuildChannel[] = []
  let liveLoaded = false
  try {
    live = await fetchGuildChannels(guildId, { fresh: true })
    liveLoaded = true
  } catch {
    live = []
  }
  if (liveLoaded) {
    base = await pruneInactiveVoicemasterChannels(guildId, base, live)
  }
  const liveById = new Map(
    live.map((c) => [String(c.id).trim(), c] as const)
  )

  const connectedIdsByChannel = new Map<string, string[]>()
  const allUserIds = new Set<string>()

  for (const row of base) {
    const ch = liveById.get(String(row.channel_id).trim())
    const ids = (ch?.connected_member_ids ?? [])
      .map((id) => String(id).trim())
      .filter(Boolean)
    connectedIdsByChannel.set(String(row.channel_id).trim(), ids)
    for (const id of ids) allUserIds.add(id)
    if (row.owner_id?.trim()) allUserIds.add(row.owner_id.trim())
  }

  const userMap = await fetchUserInfoBatch([...allUserIds])

  function memberFromUserId(userId: string): VoicemasterConnectedMember {
    const u = userMap.get(userId)
    return {
      user_id: userId,
      username: u?.username?.trim() || null,
      display_name: u?.display_name?.trim() || null,
      avatar: u?.avatar?.trim() ? u.avatar.trim() : null,
    }
  }

  return base.map((row) => {
    const ch = liveById.get(String(row.channel_id).trim()) as
      | (GuildChannel & {
          bitrate?: number
          user_limit?: number
        })
      | undefined
    const oid = row.owner_id?.trim() ? row.owner_id : null
    const u = oid ? userMap.get(oid) : undefined
    const connectedIds = connectedIdsByChannel.get(String(row.channel_id).trim()) ?? []
    return {
      guild_id: row.guild_id,
      channel_id: row.channel_id,
      owner_id: row.owner_id,
      name: ch?.name ?? null,
      member_count: ch?.member_count ?? null,
      bitrate: ch?.bitrate ?? null,
      user_limit: ch?.user_limit ?? null,
      exists: !!ch,
      owner_username: u?.username?.trim() || null,
      owner_display_name: u?.display_name?.trim() || null,
      owner_avatar: u?.avatar?.trim() ? u.avatar.trim() : null,
      connected_members: connectedIds.map(memberFromUserId),
    }
  })
}

export async function deleteChannel(channelId: string): Promise<string | null> {
  const res = await pool.query(
    `DELETE FROM voicemaster.channels
     WHERE channel_id = $1
     RETURNING owner_id`,
    [channelId]
  )
  await invalidateChannelCache(channelId)

  if (res.rows.length === 0 || res.rows[0].owner_id == null) return null
  return String(res.rows[0].owner_id)
}

export async function deleteChannels(channelIds: string[]): Promise<void> {
  if (channelIds.length === 0) return
  await pool.query(
    `DELETE FROM voicemaster.channels WHERE channel_id = ANY($1::bigint[])`,
    [channelIds]
  )
  for (const id of channelIds) {
    await invalidateChannelCache(id)
  }
}

export async function updateChannelOwner(
  channelId: string,
  ownerId: string
): Promise<void> {
  await pool.query(
    `UPDATE voicemaster.channels SET owner_id = $2 WHERE channel_id = $1`,
    [channelId, ownerId]
  )
  await invalidateChannelCache(channelId)
}

export interface VoicemasterChannelDeleteResult {
  ok: boolean
  error?: string
  disconnected_count?: number
  disconnected_user_ids?: string[]
}

function normalizeDisconnectedUserIds(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const ids = raw.map((x) => String(x).trim()).filter(Boolean)
  return ids.length ? ids : undefined
}

function parseVoicemasterDeleteBody(
  text: string,
  resOk: boolean,
  httpStatus: number
): VoicemasterChannelDeleteResult | null {
  if (!text.trim()) return null
  try {
    const raw = clusterJsonParse<Record<string, unknown>>(text)
    const okFlag: boolean | undefined =
      typeof raw.ok === 'boolean'
        ? raw.ok
        : raw.success === true
          ? true
          : raw.status === 'ok'
            ? true
            : undefined
    if (okFlag === undefined && !resOk) {
      const msg =
        typeof raw.error === 'string'
          ? raw.error
          : typeof raw.message === 'string'
            ? raw.message
            : typeof raw.detail === 'string'
              ? raw.detail
              : `Cluster API failed (${httpStatus})`
      return { ok: false, error: msg }
    }
    if (okFlag === undefined) return null
    const alt =
      normalizeDisconnectedUserIds(raw.disconnected_user_ids) ??
      normalizeDisconnectedUserIds(raw.disconnected_users) ??
      normalizeDisconnectedUserIds(raw.user_ids)
    let count = raw.disconnected_count
    if (typeof count !== 'number' && alt) count = alt.length
    return {
      ok: okFlag,
      error: typeof raw.error === 'string' ? raw.error : undefined,
      disconnected_count: typeof count === 'number' ? count : undefined,
      disconnected_user_ids: alt,
    }
  } catch {
    if (!resOk) {
      return { ok: false, error: 'Invalid response from cluster' }
    }
    return null
  }
}

export async function deleteVoicemasterChannel(
  guildId: string,
  channelId: string
): Promise<VoicemasterChannelDeleteResult> {
  const body = JSON.stringify({ channel_id: channelId, guild_id: guildId })
  const primaryPath = `/guild/${guildId}/voicemaster/channel/delete`
  const fallbackPath = `/guild/${guildId}/voicemaster/delete_channel`

  async function tryPath(path: string): Promise<{ res: Response; text: string }> {
    const res = await fetch(`${CLUSTER_API_BASE}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body,
      cache: 'no-store',
    })
    const text = await res.text()
    return { res, text }
  }

  try {
    let { res, text } = await tryPath(primaryPath)
    if (res.status === 404) {
      ;({ res, text } = await tryPath(fallbackPath))
    }

    const parsed = parseVoicemasterDeleteBody(text, res.ok, res.status)
    if (parsed) return parsed

    if (!res.ok) {
      return {
        ok: false,
        error: `Cluster API failed (${res.status})`,
      }
    }
    return { ok: true }
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error ? e.message : 'Could not reach cluster (check CLUSTER_API_URL)',
    }
  }
}

export interface VoicemasterMemberDisconnectResult {
  ok: boolean
  error?: string
  disconnected_user_ids?: string[]
  failed_user_ids?: string[]
}

export async function disconnectVoicemasterMembers(
  guildId: string,
  channelId: string,
  userIds: string[]
): Promise<VoicemasterMemberDisconnectResult> {
  const ids = [...new Set(userIds.map((x) => String(x).trim()).filter(Boolean))]
  if (ids.length === 0) {
    return { ok: false, error: 'No user IDs provided' }
  }

  try {
    const res = await fetch(
      `${CLUSTER_API_BASE}/guild/${guildId}/voicemaster/channels/${channelId}/disconnect`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ user_ids: ids }),
        cache: 'no-store',
      }
    )
    const text = await res.text()
    if (!text.trim()) {
      if (!res.ok) {
        return { ok: false, error: `Cluster API failed (${res.status})` }
      }
      return { ok: true, disconnected_user_ids: ids }
    }

    let raw: Record<string, unknown>
    try {
      raw = clusterJsonParse<Record<string, unknown>>(text)
    } catch {
      return { ok: false, error: 'Invalid response from cluster' }
    }

    if (!res.ok || raw.ok === false) {
      const detail =
        typeof raw.detail === 'string'
          ? raw.detail
          : typeof raw.error === 'string'
            ? raw.error
            : `Cluster API failed (${res.status})`
      return { ok: false, error: detail }
    }

    const disconnected = normalizeDisconnectedUserIds(raw.disconnected_user_ids) ?? []
    const failed = normalizeDisconnectedUserIds(raw.failed_user_ids) ?? []
    return {
      ok: true,
      disconnected_user_ids: disconnected.length ? disconnected : ids,
      failed_user_ids: failed.length ? failed : undefined,
    }
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error ? e.message : 'Could not reach cluster (check CLUSTER_API_URL)',
    }
  }
}
