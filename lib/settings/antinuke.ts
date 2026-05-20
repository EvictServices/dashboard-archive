import pool from '@elira/lib/infra/db'
import redis from '@elira/lib/infra/redis'
import { xxh32 } from '@elira/lib/infra/hash'
import { isSnowflake } from '@elira/lib/discord/api'

export interface AntinukeModule {
  threshold: number
  duration: number
  punishment: 'ban' | 'kick' | 'strip'
}

export interface AntinukeSettings {
  whitelist: string[]
  trusted_admins: string[]
  bot: boolean
  ban: AntinukeModule | null
  kick: AntinukeModule | null
  role: AntinukeModule | null
  channel: AntinukeModule | null
  webhook: AntinukeModule | null
  emoji: AntinukeModule | null
}

const MODULE_NAMES = ['ban', 'kick', 'role', 'channel', 'webhook', 'emoji'] as const
type ModuleName = (typeof MODULE_NAMES)[number]

function cacheKey(guildId: string): string {
  return xxh32(`antinuke:${guildId}`)
}

function parseModule(val: unknown): AntinukeModule | null {
  if (!val || typeof val !== 'object') return null
  const m = val as Record<string, unknown>
  return {
    threshold: Number(m.threshold) || 5,
    duration: Number(m.duration) || 60,
    punishment: (['ban', 'kick', 'strip'].includes(m.punishment as string)
      ? m.punishment
      : 'ban') as AntinukeModule['punishment'],
  }
}

function toSnowflakeList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((v) => {
      if (typeof v === 'string') return v
      if (typeof v === 'number') {
        return Number.isSafeInteger(v) ? String(v) : ''
      }
      if (typeof v === 'bigint') return v.toString()
      return ''
    })
    .filter((v) => v.length > 0)
}

function rowToSettings(row: Record<string, unknown>): AntinukeSettings {
  return {
    whitelist: toSnowflakeList(row.whitelist),
    trusted_admins: toSnowflakeList(row.trusted_admins),
    bot: Boolean(row.bot),
    ban: parseModule(row.ban),
    kick: parseModule(row.kick),
    role: parseModule(row.role),
    channel: parseModule(row.channel),
    webhook: parseModule(row.webhook),
    emoji: parseModule(row.emoji),
  }
}

function settingsToCache(settings: AntinukeSettings): string {
  return JSON.stringify({
    whitelist: settings.whitelist,
    trusted_admins: settings.trusted_admins,
    bot: settings.bot,
    ban: settings.ban,
    kick: settings.kick,
    role: settings.role,
    channel: settings.channel,
    webhook: settings.webhook,
    emoji: settings.emoji,
  })
}

function parseAntinukeCache(text: string): unknown {
  const safe = text.replace(
    /"(whitelist|trusted_admins)"\s*:\s*\[([^\]]*)\]/g,
    (_match, key: string, body: string) => {
      const fixed = body.replace(/(?<!")(\d{16,20})(?!")/g, '"$1"')
      return `"${key}":[${fixed}]`
    },
  )
  return JSON.parse(safe)
}

export async function getAntinukeSettings(guildId: string): Promise<AntinukeSettings> {
  const key = cacheKey(guildId)

  const cached = await redis.get(key)
  if (cached) {
    try {
      const data = typeof cached === 'string' ? parseAntinukeCache(cached) : cached
      return rowToSettings(data as Record<string, unknown>)
    } catch {
      await redis.del(key)
    }
  }

  const res = await pool.query('SELECT * FROM antinuke WHERE guild_id = $1', [guildId])

  if (res.rows.length === 0) {
    const insert = await pool.query(
      'INSERT INTO antinuke (guild_id) VALUES ($1) RETURNING *',
      [guildId]
    )
    const settings = rowToSettings(insert.rows[0])
    await redis.set(key, settingsToCache(settings), 'EX', 300)
    return settings
  }

  const settings = rowToSettings(res.rows[0])
  await redis.set(key, settingsToCache(settings), 'EX', 300)
  return settings
}

export async function fetchGuildOwnerId(guildId: string): Promise<string | null> {
  try {
    const { fetchGuild } = await import('@elira/lib/cluster/client')
    const guild = await fetchGuild(guildId)
    const oid = guild.owner_id
    return oid != null && String(oid).trim() ? String(oid).trim() : null
  } catch {
    return null
  }
}

/** Server owner is always included in trusted admins and whitelist. */
function userListWithOwner(ids: string[], ownerId: string | null): string[] {
  if (!ownerId) return [...ids]
  if (ids.includes(ownerId)) return [...ids]
  return [ownerId, ...ids]
}

export const trustedAdminsWithOwner = userListWithOwner
export const whitelistWithOwner = userListWithOwner

export async function enrichAntinukeSettingsForClient(
  guildId: string,
  settings: AntinukeSettings
): Promise<AntinukeSettings> {
  const ownerId = await fetchGuildOwnerId(guildId)
  return {
    ...settings,
    trusted_admins: userListWithOwner(settings.trusted_admins, ownerId),
    whitelist: userListWithOwner(settings.whitelist, ownerId),
  }
}

/**
 * Whether the user may view or edit antinuke for this guild.
 * Reads `trusted_admins` from Postgres (not Redis) so every request is
 * authorized against current data, not a cached row.
 */
export async function isAntinukeAdmin(guildId: string, userId: string): Promise<boolean> {
  if (!isSnowflake(guildId) || !isSnowflake(userId)) {
    return false
  }

  const res = await pool.query(
    'SELECT trusted_admins FROM antinuke WHERE guild_id = $1',
    [guildId]
  )
  if (res.rows.length > 0) {
    const admins = toSnowflakeList(res.rows[0].trusted_admins)
    if (admins.includes(userId)) return true
  }

  try {
    const { fetchGuild } = await import('@elira/lib/cluster/client')
    const guild = await fetchGuild(guildId)
    if (guild.owner_id === userId) return true
  } catch {}

  return false
}

export async function updateAntinukeModule(
  guildId: string,
  moduleName: string,
  config: AntinukeModule | null
): Promise<void> {
  if (!MODULE_NAMES.includes(moduleName as ModuleName)) {
    throw new Error(`Invalid module: ${moduleName}`)
  }

  if (config) {
    if (config.threshold < 1 || config.threshold > 100) {
      throw new Error('Threshold must be between 1 and 100')
    }
    if (config.duration < 1 || config.duration > 86400) {
      throw new Error('Duration must be between 1 and 86400 seconds')
    }
    if (!['ban', 'kick', 'strip'].includes(config.punishment)) {
      throw new Error('Punishment must be ban, kick, or strip')
    }
  }

  await pool.query(
    `UPDATE antinuke SET ${moduleName} = $2 WHERE guild_id = $1`,
    [guildId, config ? JSON.stringify(config) : null]
  )

  const key = cacheKey(guildId)
  await redis.del(key)
}

export async function updateAntinukeBotToggle(
  guildId: string,
  toggle: boolean
): Promise<void> {
  await pool.query(
    'UPDATE antinuke SET bot = $2 WHERE guild_id = $1',
    [guildId, toggle]
  )

  const key = cacheKey(guildId)
  await redis.del(key)
}

export async function updateAntinukeWhitelist(
  guildId: string,
  ids: string[]
): Promise<void> {
  await pool.query(
    'UPDATE antinuke SET whitelist = $2::bigint[] WHERE guild_id = $1',
    [guildId, ids]
  )

  const key = cacheKey(guildId)
  await redis.del(key)
}

export async function updateAntinukeTrustedAdmins(
  guildId: string,
  ids: string[]
): Promise<void> {
  await pool.query(
    'UPDATE antinuke SET trusted_admins = $2::bigint[] WHERE guild_id = $1',
    [guildId, ids]
  )

  const key = cacheKey(guildId)
  await redis.del(key)
}
