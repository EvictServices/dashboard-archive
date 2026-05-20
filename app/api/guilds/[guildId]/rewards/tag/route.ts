import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@elira/lib/auth/session'
import { hasGuildAdmin } from '@elira/lib/discord/api'
import { getTagRewards, patchTagRewards } from '@/lib/settings/rewards'
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
  try {
    const tag = await getTagRewards(id)
    return NextResponse.json({ tag })
  } catch (e) {
    console.error('GET rewards/tag', e)
    return NextResponse.json({ error: 'Failed to load tag rewards' }, { status: 500 })
  }
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
  const patch: Partial<{ channel_id: string | null; role_ids: string[]; template: string | null }> = {}
  if ('channel_id' in body) {
    patch.channel_id =
      body.channel_id === null || body.channel_id === undefined ? null : String(body.channel_id)
  }
  if ('role_ids' in body && Array.isArray(body.role_ids)) {
    patch.role_ids = body.role_ids.map((x: unknown) => String(x))
  }
  if ('template' in body) {
    patch.template =
      body.template === null || body.template === undefined ? null : String(body.template)
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  try {
    const tag = await patchTagRewards(id, patch)
    recordDashboardAudit(session, id, 'rewards.tag.update', patch)
    return NextResponse.json({ tag })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Save failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
