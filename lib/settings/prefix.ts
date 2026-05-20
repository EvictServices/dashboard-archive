import pool from '@elira/lib/infra/db'
import redis from '@elira/lib/infra/redis'

const DEFAULT_PREFIX = ';'
const REDIS_TTL = 3600

export async function getGuildPrefix(guildId: string): Promise<string> {
  const cacheKey = `prefix:guild:${guildId}`

  const cached = await redis.get(cacheKey)
  if (cached) return cached

  const res = await pool.query(
    'SELECT prefix FROM prefix WHERE guild_id = $1',
    [guildId]
  )

  if (res.rows.length > 0 && res.rows[0].prefix) {
    const prefix = res.rows[0].prefix
    await redis.set(cacheKey, prefix, 'EX', REDIS_TTL)
    return prefix
  }

  return DEFAULT_PREFIX
}

export async function updateGuildPrefix(guildId: string, prefix: string): Promise<void> {
  if (prefix.length < 1 || prefix.length > 7) {
    throw new Error('Prefix must be between 1 and 7 characters')
  }

  const existing = await pool.query(
    'SELECT 1 FROM prefix WHERE guild_id = $1 LIMIT 1',
    [guildId]
  )

  if (existing.rows.length > 0) {
    await pool.query(
      'UPDATE prefix SET prefix = $2 WHERE guild_id = $1',
      [guildId, prefix]
    )
  } else {
    await pool.query(
      'INSERT INTO prefix (guild_id, prefix) VALUES ($1, $2)',
      [guildId, prefix]
    )
  }

  if (prefix) {
    await redis.set(`prefix:guild:${guildId}`, prefix, 'EX', REDIS_TTL)
  } else {
    await redis.del(`prefix:guild:${guildId}`)
  }
}
