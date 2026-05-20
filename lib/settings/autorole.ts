import pool from '@elira/lib/infra/db'
import redis from '@elira/lib/infra/redis'
import { xxh32 } from '@elira/lib/infra/hash'
import {
  ACTIONS,
  MIN_DELAY,
  MAX_DELAY,
  type AutoroleAction,
  type AutoroleEntry,
  type AutoroleSettings,
} from '@/lib/settings/autorole-types'

export type { AutoroleAction, AutoroleEntry, AutoroleSettings }
export { ACTIONS, MIN_DELAY, MAX_DELAY }

function cacheKey(guildId: string): string {
  return xxh32(`autorole:${guildId}`)
}

async function invalidateCache(guildId: string) {
  await redis.del(cacheKey(guildId))
  const botKeys = await redis.keys(`autorole:*:${guildId}`)
  if (botKeys.length > 0) {
    await redis.del(...botKeys)
  }
}

export async function getAutoroleSettings(guildId: string): Promise<AutoroleSettings> {
  const key = cacheKey(guildId)

  const cached = await redis.get(key)
  if (cached) {
    return JSON.parse(cached) as AutoroleSettings
  }

  const res = await pool.query(
    `SELECT role_id, action, delay, reassign_roles, reassign_ignore_ids
     FROM auto_role
     WHERE guild_id = $1
     ORDER BY role_id`,
    [guildId]
  )

  const settings: AutoroleSettings = {
    roles: res.rows.map((r) => ({
      role_id: String(r.role_id),
      action: r.action as AutoroleAction,
      delay: r.delay === null ? null : Number(r.delay),
    })),
    reassign_roles: res.rows.length > 0 ? Boolean(res.rows[0].reassign_roles) : false,
    reassign_ignore_ids:
      res.rows.length > 0 && Array.isArray(res.rows[0].reassign_ignore_ids)
        ? res.rows[0].reassign_ignore_ids.map((id: unknown) => String(id))
        : [],
  }

  await redis.set(key, JSON.stringify(settings), 'EX', 300)
  return settings
}

export async function addAutorole(
  guildId: string,
  roleId: string,
  action: AutoroleAction,
  delay: number | null
): Promise<void> {
  if (!ACTIONS.includes(action)) {
    throw new Error('Action must be add or remove')
  }
  if (action === 'remove' && (!delay || delay < MIN_DELAY)) {
    throw new Error('A delay is required when removing a role')
  }
  if (delay !== null && (delay < MIN_DELAY || delay > MAX_DELAY)) {
    throw new Error(`Delay must be between ${MIN_DELAY} and ${MAX_DELAY} seconds`)
  }

  await pool.query(
    `INSERT INTO auto_role (guild_id, role_id, action, delay)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (guild_id, role_id, action)
     DO UPDATE SET delay = EXCLUDED.delay`,
    [guildId, roleId, action, delay]
  )

  await invalidateCache(guildId)
}

export async function removeAutorole(
  guildId: string,
  roleId: string,
  action?: AutoroleAction
): Promise<boolean> {
  let result
  if (action) {
    result = await pool.query(
      `DELETE FROM auto_role WHERE guild_id = $1 AND role_id = $2 AND action = $3`,
      [guildId, roleId, action]
    )
  } else {
    result = await pool.query(
      `DELETE FROM auto_role WHERE guild_id = $1 AND role_id = $2`,
      [guildId, roleId]
    )
  }

  await invalidateCache(guildId)
  return (result.rowCount ?? 0) > 0
}

export async function clearAutoroles(guildId: string): Promise<number> {
  const result = await pool.query(
    `DELETE FROM auto_role WHERE guild_id = $1`,
    [guildId]
  )
  await invalidateCache(guildId)
  return result.rowCount ?? 0
}

export async function setReassignRoles(
  guildId: string,
  enabled: boolean
): Promise<void> {
  const result = await pool.query(
    `UPDATE auto_role SET reassign_roles = $2 WHERE guild_id = $1`,
    [guildId, enabled]
  )

  if ((result.rowCount ?? 0) === 0) {
    throw new Error('Configure at least one auto role before toggling reassign')
  }

  await invalidateCache(guildId)
}

export async function setReassignIgnoreIds(
  guildId: string,
  ids: string[]
): Promise<void> {
  const result = await pool.query(
    `UPDATE auto_role SET reassign_ignore_ids = $2 WHERE guild_id = $1`,
    [guildId, ids.map((id) => Number(id))]
  )

  if ((result.rowCount ?? 0) === 0) {
    throw new Error('Configure at least one auto role before changing ignored roles')
  }

  await invalidateCache(guildId)
}
