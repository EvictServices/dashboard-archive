import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { hasGuildAdmin } from '@elira/lib/discord/api'
import { getGuildRoleplayEnabled, setGuildRoleplayEnabled } from '@/lib/settings/roleplay'
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

  const enabled = await getGuildRoleplayEnabled(id)
  return NextResponse.json(
    { enabled },
    { headers: { 'Cache-Control': 'private, max-age=5, stale-while-revalidate=30' } }
  )
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

  const body = await req.json().catch(() => ({}))
  const enabled = body?.enabled

  if (typeof enabled !== 'boolean') {
    return NextResponse.json({ error: 'Body must include enabled as a boolean' }, { status: 400 })
  }

  await setGuildRoleplayEnabled(id, enabled)
  recordDashboardAudit(session, id, 'roleplay.enabled.update', { enabled })
  return NextResponse.json({ enabled })
}
