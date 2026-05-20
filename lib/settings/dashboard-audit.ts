import type { Session } from '@elira/lib/auth/session'
import pool from '@elira/lib/infra/db'

export interface DashboardAuditEntry {
  id: string
  guild_id: string
  user_id: string
  actor_username: string | null
  action: string
  detail: Record<string, unknown>
  created_at: string
}

async function appendDashboardAudit(params: {
  guildId: string
  userId: string
  actorUsername: string | null
  action: string
  detail?: Record<string, unknown>
}): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO dashboard_audit_log (guild_id, user_id, actor_username, action, detail)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [
        params.guildId,
        params.userId,
        params.actorUsername,
        params.action,
        JSON.stringify(params.detail ?? {}),
      ]
    )
  } catch (err) {
    console.error('[dashboard_audit] insert failed', err)
  }
}

export function recordDashboardAudit(
  session: Session,
  guildId: string,
  action: string,
  detail?: Record<string, unknown>
): void {
  void appendDashboardAudit({
    guildId,
    userId: session.userId,
    actorUsername: session.username,
    action,
    detail,
  })
}

export async function listDashboardAuditLogs(
  guildId: string,
  limit: number
): Promise<DashboardAuditEntry[]> {
  const cap = Math.min(Math.max(limit, 1), 100)
  const res = await pool.query(
    `SELECT id, guild_id, user_id, actor_username, action, detail, created_at
     FROM dashboard_audit_log
     WHERE guild_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [guildId, cap]
  )
  return res.rows.map((row) => ({
    id: String(row.id),
    guild_id: String(row.guild_id),
    user_id: String(row.user_id),
    actor_username: row.actor_username as string | null,
    action: String(row.action),
    detail:
      row.detail && typeof row.detail === 'object' && !Array.isArray(row.detail)
        ? (row.detail as Record<string, unknown>)
        : {},
    created_at:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
  }))
}
