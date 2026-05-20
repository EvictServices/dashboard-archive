import { NextResponse } from 'next/server'
import pool from '@elira/lib/infra/db'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ guildId: string }> }
) {
  const { guildId } = await params

  if (!guildId || !/^\d+$/.test(guildId)) {
    return NextResponse.json({ error: 'Invalid guild ID' }, { status: 400 })
  }

  try {
    const result = await pool.query(
      `SELECT user_id, xp, level, total_xp
       FROM level.member
       WHERE guild_id = $1
       ORDER BY total_xp DESC
       LIMIT 100`,
      [guildId]
    )

    return NextResponse.json({ members: result.rows })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 })
  }
}
