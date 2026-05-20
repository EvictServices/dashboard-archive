import pool from '@elira/lib/infra/db'

export interface DisabledCommandGroup {
  command: string
  channel_ids: string[]
}

export async function listDisabledCommands(guildId: string): Promise<DisabledCommandGroup[]> {
  const res = await pool.query(
    `SELECT command, array_agg(channel_id::text ORDER BY channel_id) AS channel_ids
     FROM commands.disabled
     WHERE guild_id = $1::bigint
     GROUP BY command
     ORDER BY command`,
    [guildId]
  )
  return res.rows.map((r) => ({
    command: String(r.command),
    channel_ids: Array.isArray(r.channel_ids) ? r.channel_ids.map(String) : [],
  }))
}

export async function addDisabledCommandRows(
  guildId: string,
  command: string,
  channelIds: string[]
): Promise<void> {
  if (channelIds.length === 0) return
  await pool.query(
    `INSERT INTO commands.disabled (guild_id, channel_id, command)
     SELECT $1::bigint, cid::bigint, $2
     FROM unnest($3::text[]) AS u(cid)
     ON CONFLICT (guild_id, channel_id, command) DO NOTHING`,
    [guildId, command, channelIds]
  )
}

export async function removeDisabledCommandRows(
  guildId: string,
  command: string,
  channelIds: string[]
): Promise<void> {
  if (channelIds.length === 0) return
  await pool.query(
    `DELETE FROM commands.disabled
     WHERE guild_id = $1::bigint AND command = $2 AND channel_id = ANY($3::bigint[])`,
    [guildId, command, channelIds]
  )
}
