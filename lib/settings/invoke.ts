import pool from '@elira/lib/infra/db'
import { isInvokeActionType, type InvokeActionType } from './invoke-constants'

export * from './invoke-constants'

const MAX_TEMPLATE_LEN = 12000

export async function listInvokeTemplates(
  guildId: string
): Promise<Partial<Record<InvokeActionType, string>>> {
  const res = await pool.query<{ action_type: string; messages: unknown }>(
    'SELECT action_type, messages FROM invoke.base WHERE guild_id = $1',
    [guildId]
  )
  const out: Partial<Record<InvokeActionType, string>> = {}
  for (const row of res.rows) {
    if (!isInvokeActionType(row.action_type)) continue
    const key = row.action_type
    const msgs = row.messages
    let first: string | null = null
    if (Array.isArray(msgs) && msgs.length > 0 && typeof msgs[0] === 'string') {
      first = msgs[0]
    } else if (msgs != null && typeof msgs === 'string') {
      first = msgs
    }
    if (first != null && first.length > 0) out[key] = first
  }
  return out
}

export async function upsertInvokeTemplate(
  guildId: string,
  actionType: string,
  template: string
): Promise<void> {
  if (!isInvokeActionType(actionType)) {
    throw new Error('Invalid action type')
  }
  const trimmed = template.trim()
  if (trimmed.length === 0) {
    throw new Error('Template cannot be empty')
  }
  if (trimmed.length > MAX_TEMPLATE_LEN) {
    throw new Error(`Template must be at most ${MAX_TEMPLATE_LEN} characters`)
  }
  await pool.query(
    `INSERT INTO invoke.base (guild_id, action_type, messages)
     VALUES ($1, $2, $3::text[])
     ON CONFLICT (guild_id, action_type)
     DO UPDATE SET messages = EXCLUDED.messages`,
    [guildId, actionType, [trimmed]]
  )
}

export async function deleteInvokeTemplate(guildId: string, actionType: string): Promise<boolean> {
  if (!isInvokeActionType(actionType)) {
    throw new Error('Invalid action type')
  }
  const res = await pool.query(
    'DELETE FROM invoke.base WHERE guild_id = $1 AND action_type = $2',
    [guildId, actionType]
  )
  return (res.rowCount ?? 0) > 0
}
