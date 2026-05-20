import pool from '@elira/lib/infra/db'

export interface RestrictionGroup {
  command: string
  role_ids: string[]
}

export async function listCommandRestrictions(guildId: string): Promise<RestrictionGroup[]> {
  const res = await pool.query(
    `SELECT command, array_agg(role_id::text ORDER BY role_id) AS role_ids
     FROM commands.restricted
     WHERE guild_id = $1::bigint
     GROUP BY command
     ORDER BY command`,
    [guildId]
  )
  return res.rows.map((r) => ({
    command: String(r.command),
    role_ids: Array.isArray(r.role_ids) ? r.role_ids.map(String) : [],
  }))
}

export async function addRestrictionRows(
  guildId: string,
  command: string,
  roleIds: string[]
): Promise<void> {
  if (roleIds.length === 0) return
  await pool.query(
    `INSERT INTO commands.restricted (guild_id, role_id, command)
     SELECT $1::bigint, rid::bigint, $2
     FROM unnest($3::text[]) AS u(rid)
     WHERE NOT EXISTS (
       SELECT 1 FROM commands.restricted r
       WHERE r.guild_id = $1::bigint AND r.role_id = rid::bigint AND r.command = $2
     )`,
    [guildId, command, roleIds]
  )
}

export async function removeRestrictionRows(
  guildId: string,
  command: string,
  roleIds: string[]
): Promise<void> {
  if (roleIds.length === 0) return
  await pool.query(
    `DELETE FROM commands.restricted
     WHERE guild_id = $1::bigint AND command = $2 AND role_id = ANY($3::bigint[])`,
    [guildId, command, roleIds]
  )
}
