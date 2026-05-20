import pool from '@elira/lib/infra/db'

export type ScriptMessageKind = 'welcome' | 'boost' | 'goodbye'

interface KindConfig {
  table: string
  label: string
  pluralLabel: string
  hasDeleteAfter: boolean
}

const KIND_CONFIG: Record<ScriptMessageKind, KindConfig> = {
  welcome: {
    table: 'welcome_message',
    label: 'Welcome message',
    pluralLabel: 'welcome messages',
    hasDeleteAfter: false,
  },
  boost: {
    table: 'boost_message',
    label: 'Boost message',
    pluralLabel: 'boost messages',
    hasDeleteAfter: true,
  },
  goodbye: {
    table: 'goodbye_message',
    label: 'Leave message',
    pluralLabel: 'leave messages',
    hasDeleteAfter: true,
  },
}

const MAX_CHANNELS = 2

export interface ScriptMessageRow {
  channel_id: string
  template: string
  delete_after: number | null
}

export async function listMessages(
  kind: ScriptMessageKind,
  guildId: string
): Promise<ScriptMessageRow[]> {
  const { table, hasDeleteAfter } = KIND_CONFIG[kind]
  const cols = hasDeleteAfter
    ? 'channel_id::text, template, delete_after'
    : 'channel_id::text, template'
  const res = await pool.query(
    `SELECT ${cols} FROM ${table} WHERE guild_id = $1::bigint ORDER BY channel_id`,
    [guildId]
  )
  return res.rows.map((r) => ({
    channel_id: String(r.channel_id),
    template: String(r.template ?? ''),
    delete_after: r.delete_after != null ? Number(r.delete_after) : null,
  }))
}

export async function upsertMessage(
  kind: ScriptMessageKind,
  guildId: string,
  channelId: string,
  template: string,
  fromChannelId?: string | null,
  deleteAfter?: number | null
): Promise<void> {
  const { table, label, pluralLabel, hasDeleteAfter } = KIND_CONFIG[kind]
  const trimmed = template.trim()
  if (!trimmed) {
    throw new Error(`${label} cannot be empty`)
  }

  const from = fromChannelId?.trim() || null
  if (from && from !== channelId) {
    const before = await listMessages(kind, guildId)
    if (before.some((r) => r.channel_id === from)) {
      await deleteMessage(kind, guildId, from)
    }
  }

  const existing = await pool.query(
    `SELECT channel_id FROM ${table} WHERE guild_id = $1::bigint`,
    [guildId]
  )
  const channels = new Set(existing.rows.map((r) => String(r.channel_id)))
  if (!channels.has(channelId) && channels.size >= MAX_CHANNELS) {
    throw new Error(
      `You can only have up to ${MAX_CHANNELS} ${pluralLabel}. Remove one first.`
    )
  }

  if (hasDeleteAfter) {
    let value: number | null
    if (deleteAfter !== undefined) {
      value = deleteAfter
    } else if (from && from !== channelId) {
      value = null
    } else {
      const cur = await pool.query(
        `SELECT delete_after FROM ${table} WHERE guild_id = $1::bigint AND channel_id = $2::bigint`,
        [guildId, channelId]
      )
      const v = cur.rows[0]?.delete_after
      value = v != null ? Number(v) : null
    }
    await pool.query(
      `INSERT INTO ${table} (guild_id, channel_id, template, delete_after)
       VALUES ($1::bigint, $2::bigint, $3, $4)
       ON CONFLICT (guild_id, channel_id)
       DO UPDATE SET template = EXCLUDED.template, delete_after = EXCLUDED.delete_after`,
      [guildId, channelId, trimmed, value]
    )
  } else {
    await pool.query(
      `INSERT INTO ${table} (guild_id, channel_id, template)
       VALUES ($1::bigint, $2::bigint, $3)
       ON CONFLICT (guild_id, channel_id)
       DO UPDATE SET template = EXCLUDED.template`,
      [guildId, channelId, trimmed]
    )
  }
}

export async function deleteMessage(
  kind: ScriptMessageKind,
  guildId: string,
  channelId: string
): Promise<boolean> {
  const { table } = KIND_CONFIG[kind]
  const res = await pool.query(
    `DELETE FROM ${table} WHERE guild_id = $1::bigint AND channel_id = $2::bigint`,
    [guildId, channelId]
  )
  return (res.rowCount ?? 0) > 0
}
