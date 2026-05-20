import pool from '@elira/lib/infra/db'
import redis from '@elira/lib/infra/redis'

function roleplayCacheKey(guildId: string): string {
  return `roleplay_enabled:${guildId}`
}

export async function getGuildRoleplayEnabled(guildId: string): Promise<boolean> {
  const res = await pool.query<{ toggled: boolean }>(
    'SELECT toggled FROM roleplay.enabled WHERE guild_id = $1 LIMIT 1',
    [guildId]
  )
  if (res.rows.length === 0) return false
  return res.rows[0].toggled === true
}

export async function setGuildRoleplayEnabled(guildId: string, enabled: boolean): Promise<void> {
  await pool.query(
    `INSERT INTO roleplay.enabled (guild_id, toggled)
     VALUES ($1, $2)
     ON CONFLICT (guild_id)
     DO UPDATE SET toggled = $2`,
    [guildId, enabled]
  )
  try {
    await redis.del(roleplayCacheKey(guildId))
  } catch {
  }
}
