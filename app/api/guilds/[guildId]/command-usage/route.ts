import { NextResponse } from 'next/server'
import { getSession } from '@elira/lib/auth/session'
import { hasGuildAdmin } from '@elira/lib/discord/api'
import pool from '@elira/lib/infra/db'

export const dynamic = 'force-dynamic'

const CAT_FILTER = `AND COALESCE(category, '') NOT IN ('Developer', 'Jishaku')`

const ALLOWED_DAYS = new Set([7, 30, 90, 365])

function parseDays(req: Request): number {
  const raw = new URL(req.url).searchParams.get('days')
  const n = raw == null ? NaN : Number(raw)
  return ALLOWED_DAYS.has(n) ? n : 30
}

/** Guild command analytics: top commands, daily series, period trends. */
export async function GET(req: Request, { params }: { params: Promise<{ guildId: string }> }) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { guildId: id } = await params
  if (!id || !/^\d+$/.test(id)) {
    return NextResponse.json({ error: 'Invalid guild ID' }, { status: 400 })
  }

  if (!(await hasGuildAdmin(session.accessToken, id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const days = parseDays(req)

  try {
    const [
      topRes,
      totalRes,
      dailyRes,
      invWindowRes,
      distinctCurRes,
      distinctPrevRes,
      categoriesRes,
    ] = await Promise.all([
      pool.query(
        `SELECT command_name, category, COUNT(*)::int AS count
         FROM invoke_history.commands
         WHERE guild_id = $1::bigint
           AND "timestamp" >= NOW() - ($2::int * INTERVAL '1 day')
           ${CAT_FILTER}
         GROUP BY command_name, category
         ORDER BY count DESC
         LIMIT 16`,
        [id, days]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS count
         FROM invoke_history.commands
         WHERE guild_id = $1::bigint
           AND "timestamp" >= NOW() - ($2::int * INTERVAL '1 day')
           ${CAT_FILTER}`,
        [id, days]
      ),
      pool.query(
        `SELECT
           to_char(("timestamp" AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
           COUNT(*)::int AS invocations,
           COUNT(DISTINCT command_name)::int AS distinct_commands
         FROM invoke_history.commands
         WHERE guild_id = $1::bigint
           AND "timestamp" >= NOW() - ($2::int * INTERVAL '1 day')
           ${CAT_FILTER}
         GROUP BY 1
         ORDER BY 1 ASC`,
        [id, days]
      ),
      pool.query(
        `SELECT
           COUNT(*) FILTER (
             WHERE "timestamp" >= NOW() - ($2::int * INTERVAL '1 day')
           )::int AS cur,
           COUNT(*) FILTER (
             WHERE "timestamp" >= NOW() - ($2::int * 2 * INTERVAL '1 day')
               AND "timestamp" < NOW() - ($2::int * INTERVAL '1 day')
           )::int AS prev
         FROM invoke_history.commands
         WHERE guild_id = $1::bigint
           AND "timestamp" >= NOW() - ($2::int * 2 * INTERVAL '1 day')
           ${CAT_FILTER}`,
        [id, days]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS c FROM (
           SELECT DISTINCT command_name
           FROM invoke_history.commands
           WHERE guild_id = $1::bigint
             AND "timestamp" >= NOW() - ($2::int * INTERVAL '1 day')
             ${CAT_FILTER}
         ) sub`,
        [id, days]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS c FROM (
           SELECT DISTINCT command_name
           FROM invoke_history.commands
           WHERE guild_id = $1::bigint
             AND "timestamp" >= NOW() - ($2::int * 2 * INTERVAL '1 day')
             AND "timestamp" < NOW() - ($2::int * INTERVAL '1 day')
             ${CAT_FILTER}
         ) sub`,
        [id, days]
      ),
      pool.query(
        `SELECT COALESCE(NULLIF(TRIM(category), ''), 'Other') AS category, COUNT(*)::int AS count
         FROM invoke_history.commands
         WHERE guild_id = $1::bigint
           AND "timestamp" >= NOW() - ($2::int * INTERVAL '1 day')
           ${CAT_FILTER}
         GROUP BY 1
         ORDER BY count DESC
         LIMIT 10`,
        [id, days]
      ),
    ])

    const inv = invWindowRes.rows[0] as { cur: unknown; prev: unknown } | undefined

    return NextResponse.json({
      days,
      commands: topRes.rows as { command_name: string; category: string | null; count: number }[],
      categories: categoriesRes.rows as { category: string; count: number }[],
      daily: dailyRes.rows.map((row) => ({
        day: String(row.day ?? '')
          .trim()
          .slice(0, 10),
        invocations: Number(row.invocations) || 0,
        distinct_commands: Number(row.distinct_commands) || 0,
      })),
      total: Number(totalRes.rows[0]?.count ?? 0) || 0,
      invocations: {
        current: Number(inv?.cur ?? 0) || 0,
        previous: Number(inv?.prev ?? 0) || 0,
      },
      distinct_commands: {
        current: Number(distinctCurRes.rows[0]?.c ?? 0) || 0,
        previous: Number(distinctPrevRes.rows[0]?.c ?? 0) || 0,
      },
    })
  } catch {
    return NextResponse.json({
      days,
      commands: [],
      categories: [],
      daily: [],
      total: 0,
      invocations: { current: 0, previous: 0 },
      distinct_commands: { current: 0, previous: 0 },
    })
  }
}
