import pool from '@elira/lib/infra/db'
import { isSnowflake } from '@elira/lib/discord/api'

export interface TicketConfigPublic {
  guild_id: string
  panel_channel_id: string
  panel_message_id: string
  channel_name: string | null
  staff_ids: string[]
  blacklisted_ids: string[]
}

export interface TicketButtonPublic {
  identifier: string
  template: string | null
  category_id: string | null
  topic: string | null
}

export interface TicketSettingsResponse {
  configured: boolean
  config: TicketConfigPublic | null
  logs_channel_id: string | null
  buttons: TicketButtonPublic[]
  open_ticket_count: number
}

function snowflakeArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.map((x) => String(x))
}

export async function getTicketSettings(guildId: string): Promise<TicketSettingsResponse> {
  const configRes = await pool.query(
    `SELECT guild_id, channel_id, message_id, staff_ids, blacklisted_ids, channel_name
     FROM ticket.config WHERE guild_id = $1`,
    [guildId]
  )

  if (configRes.rows.length === 0) {
    return {
      configured: false,
      config: null,
      logs_channel_id: null,
      buttons: [],
      open_ticket_count: 0,
    }
  }

  const row = configRes.rows[0]

  const [logsRes, buttonsRes, openRes] = await Promise.all([
    pool.query(`SELECT channel_id FROM ticket.logs WHERE guild_id = $1`, [guildId]),
    pool.query(
      `SELECT identifier, template, category_id, topic
       FROM ticket.button WHERE guild_id = $1 ORDER BY identifier`,
      [guildId]
    ),
    pool.query(`SELECT COUNT(*)::int AS c FROM ticket.open WHERE guild_id = $1`, [guildId]),
  ])

  return {
    configured: true,
    config: {
      guild_id: String(row.guild_id),
      panel_channel_id: String(row.channel_id),
      panel_message_id: String(row.message_id),
      channel_name: row.channel_name as string | null,
      staff_ids: snowflakeArray(row.staff_ids),
      blacklisted_ids: snowflakeArray(row.blacklisted_ids),
    },
    logs_channel_id: logsRes.rows[0] ? String(logsRes.rows[0].channel_id) : null,
    buttons: buttonsRes.rows.map((b) => ({
      identifier: String(b.identifier),
      template: b.template as string | null,
      category_id: b.category_id == null ? null : String(b.category_id),
      topic: b.topic as string | null,
    })),
    open_ticket_count: Number(openRes.rows[0]?.c ?? 0),
  }
}

async function hasTicketConfig(guildId: string): Promise<boolean> {
  const r = await pool.query(`SELECT 1 FROM ticket.config WHERE guild_id = $1 LIMIT 1`, [guildId])
  return r.rows.length > 0
}

function assertSnowflake(id: string, label: string) {
  if (!isSnowflake(id)) {
    throw new Error(`Invalid ${label}`)
  }
}

const IDENTIFIER_RE = /^[a-zA-Z0-9_-]{1,100}$/

function assertButtonIdentifier(id: string) {
  if (!IDENTIFIER_RE.test(id)) {
    throw new Error('Invalid button identifier')
  }
}

export async function setTicketChannelNameTemplate(
  guildId: string,
  channelName: string | null
): Promise<void> {
  if (!(await hasTicketConfig(guildId))) {
    throw new Error('Ticket panel is not configured. Run `ticket setup` or `ticket panel` in Discord first.')
  }
  await pool.query(`UPDATE ticket.config SET channel_name = $2 WHERE guild_id = $1`, [
    guildId,
    channelName,
  ])
}

export async function setTicketLogsChannel(
  guildId: string,
  channelId: string | null
): Promise<void> {
  if (channelId === null) {
    await pool.query(`DELETE FROM ticket.logs WHERE guild_id = $1`, [guildId])
    return
  }
  assertSnowflake(channelId, 'channel id')
  await pool.query(
    `INSERT INTO ticket.logs (guild_id, channel_id) VALUES ($1, $2)
     ON CONFLICT (guild_id) DO UPDATE SET channel_id = EXCLUDED.channel_id`,
    [guildId, channelId]
  )
}

export async function addTicketStaffRole(guildId: string, roleId: string): Promise<void> {
  if (!(await hasTicketConfig(guildId))) {
    throw new Error('Ticket panel is not configured.')
  }
  assertSnowflake(roleId, 'role id')
  await pool.query(
    `UPDATE ticket.config
     SET staff_ids = ARRAY_APPEND(staff_ids, $2::bigint)
     WHERE guild_id = $1
     AND NOT ($2::bigint = ANY(staff_ids))`,
    [guildId, roleId]
  )
}

export async function removeTicketStaffRole(guildId: string, roleId: string): Promise<void> {
  if (!(await hasTicketConfig(guildId))) {
    throw new Error('Ticket panel is not configured.')
  }
  assertSnowflake(roleId, 'role id')
  await pool.query(
    `UPDATE ticket.config
     SET staff_ids = ARRAY_REMOVE(staff_ids, $2::bigint)
     WHERE guild_id = $1`,
    [guildId, roleId]
  )
}

export async function addTicketBlacklist(guildId: string, targetId: string): Promise<void> {
  if (!(await hasTicketConfig(guildId))) {
    throw new Error('Ticket panel is not configured.')
  }
  assertSnowflake(targetId, 'user or role id')
  await pool.query(
    `UPDATE ticket.config
     SET blacklisted_ids = ARRAY_APPEND(blacklisted_ids, $2::bigint)
     WHERE guild_id = $1
     AND NOT ($2::bigint = ANY(blacklisted_ids))`,
    [guildId, targetId]
  )
}

export async function removeTicketBlacklist(guildId: string, targetId: string): Promise<void> {
  if (!(await hasTicketConfig(guildId))) {
    throw new Error('Ticket panel is not configured.')
  }
  assertSnowflake(targetId, 'user or role id')
  await pool.query(
    `UPDATE ticket.config
     SET blacklisted_ids = ARRAY_REMOVE(blacklisted_ids, $2::bigint)
     WHERE guild_id = $1`,
    [guildId, targetId]
  )
}

export async function setTicketButtonTemplate(
  guildId: string,
  identifier: string,
  template: string | null
): Promise<void> {
  assertButtonIdentifier(identifier)
  const r = await pool.query(
    `UPDATE ticket.button SET template = $3 WHERE guild_id = $1 AND identifier = $2`,
    [guildId, identifier, template]
  )
  if (r.rowCount === 0) {
    throw new Error('No ticket button with that identifier')
  }
}

export async function setTicketButtonCategory(
  guildId: string,
  identifier: string,
  categoryId: string | null
): Promise<void> {
  assertButtonIdentifier(identifier)
  if (categoryId !== null) {
    assertSnowflake(categoryId, 'category id')
  }
  const r = await pool.query(
    categoryId === null
      ? `UPDATE ticket.button SET category_id = NULL WHERE guild_id = $1 AND identifier = $2`
      : `UPDATE ticket.button SET category_id = $3::bigint WHERE guild_id = $1 AND identifier = $2`,
    categoryId === null ? [guildId, identifier] : [guildId, identifier, categoryId]
  )
  if (r.rowCount === 0) {
    throw new Error('No ticket button with that identifier')
  }
}

export async function deleteTicketButton(guildId: string, identifier: string): Promise<void> {
  assertButtonIdentifier(identifier)
  const r = await pool.query(
    `DELETE FROM ticket.button WHERE guild_id = $1 AND identifier = $2`,
    [guildId, identifier]
  )
  if (r.rowCount === 0) {
    throw new Error('No ticket button with that identifier')
  }
}
