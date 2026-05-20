import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@elira/lib/auth/session'
import { hasGuildAdmin } from '@elira/lib/discord/api'
import { getGuildPrefix, updateGuildPrefix } from '@/lib/settings/prefix'
import { recordDashboardAudit } from '@/lib/settings/dashboard-audit'

export async function GET(
  _req: NextRequest,
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

  const prefix = await getGuildPrefix(id)
  return NextResponse.json({ prefix }, {
    headers: { 'Cache-Control': 'private, max-age=5, stale-while-revalidate=30' },
  })
}

export async function PATCH(
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
  const body = await req.json()
  const prefix = body?.prefix

  if (typeof prefix !== 'string' || prefix.length < 1 || prefix.length > 7) {
    return NextResponse.json(
      { error: 'Prefix must be between 1 and 7 characters' },
      { status: 400 }
    )
  }

  await updateGuildPrefix(id, prefix)
  recordDashboardAudit(session, id, 'prefix.update', { prefix })
  return NextResponse.json({ prefix })
}
