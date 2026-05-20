import { NextResponse } from 'next/server'
import { getSession } from '@elira/lib/auth/session'
import { loadDashboardGuildLists } from '@/lib/guilds'

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { guilds } = await loadDashboardGuildLists(session)
    return NextResponse.json({
      guilds: guilds.map((g) => ({
        id: g.id,
        name: g.name,
        icon_url: g.icon_url,
        member_count: g.member_count,
      })),
    })
  } catch (e) {
    console.error('GET /api/guilds', e)
    return NextResponse.json({ error: 'Failed to load servers' }, { status: 500 })
  }
}
