import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { hasGuildAdmin } from '@elira/lib/discord/api'
import { getVanityRewards, patchVanityRewards } from '@/lib/settings/rewards'
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
    const vanity = await getVanityRewards(id)
    return NextResponse.json({ vanity })
  } catch (e) {
    console.error('GET rewards/vanity', e)
    return NextResponse.json({ error: 'Failed to load vanity rewards' }, { status: 500 })
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
  const patch: Partial<{ channel_id: string | null; role_id: string | null; template: string | null }> = {}
  if ('channel_id' in body) {
    patch.channel_id =
      body.channel_id === null || body.channel_id === undefined ? null : String(body.channel_id)
  }
  if ('role_id' in body) {
    patch.role_id =
      body.role_id === null || body.role_id === undefined ? null : String(body.role_id)
  }
  if ('template' in body) {
    patch.template =
      body.template === null || body.template === undefined ? null : String(body.template)
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  try {
    const vanity = await patchVanityRewards(id, patch)
    recordDashboardAudit(session, id, 'rewards.vanity.update', patch)
    return NextResponse.json({ vanity })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Save failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
