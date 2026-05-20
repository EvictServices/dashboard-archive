import pool from '@elira/lib/infra/db'

export async function listIgnoredTargets(guildId: string): Promise<string[]> {
  const res = await pool.query(
    `SELECT target_id::text AS target_id
     FROM commands.ignore
     WHERE guild_id = $1::bigint
     ORDER BY target_id`,
    [guildId]
  )
  return res.rows.map((r) => String(r.target_id))
}

export async function addIgnoreTarget(guildId: string, targetId: string): Promise<boolean> {
  const r = await pool.query(
    `INSERT INTO commands.ignore (guild_id, target_id)
     VALUES ($1::bigint, $2::bigint)
     ON CONFLICT (guild_id, target_id) DO NOTHING
     RETURNING true`,
    [guildId, targetId]
  )
  return r.rows.length > 0
}

export async function removeIgnoreTarget(guildId: string, targetId: string): Promise<boolean> {
  const r = await pool.query(
    `DELETE FROM commands.ignore
     WHERE guild_id = $1::bigint AND target_id = $2::bigint`,
    [guildId, targetId]
  )
  return (r.rowCount ?? 0) > 0
}
