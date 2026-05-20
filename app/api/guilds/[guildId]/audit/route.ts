import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { hasGuildAdmin } from '@elira/lib/discord/api'
import { listDashboardAuditLogs } from '@/lib/settings/dashboard-audit'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { guildId: id } = await params

  if (!(await hasGuildAdmin(session.accessToken, id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const rawLimit = req.nextUrl.searchParams.get('limit')
  const limit = rawLimit ? Number(rawLimit) : 50

  try {
    const entries = await listDashboardAuditLogs(id, Number.isFinite(limit) ? limit : 50)
    return NextResponse.json(
      { entries },
      { headers: { 'Cache-Control': 'private, no-store' } }
    )
  } catch {
    return NextResponse.json(
      { entries: [], unavailable: true },
      { headers: { 'Cache-Control': 'private, no-store' } }
    )
  }
}
