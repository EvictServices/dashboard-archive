import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@elira/lib/auth/session'
import { hasGuildAdmin } from '@elira/lib/discord/api'
import {
  disconnectVoicemasterMembers,
  getEnrichedChannels,
} from '@/lib/settings/voicemaster'
import { recordDashboardAudit } from '@/lib/settings/dashboard-audit'

export async function POST(
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

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const channelId = String(body.channel_id ?? '').trim()
  const rawUserIds = body.user_ids
  if (!channelId) {
    return NextResponse.json({ error: 'channel_id is required' }, { status: 400 })
  }
  if (!Array.isArray(rawUserIds) || rawUserIds.length === 0) {
    return NextResponse.json({ error: 'user_ids must be a non-empty array' }, { status: 400 })
  }

  const userIds = rawUserIds.map((x) => String(x).trim()).filter(Boolean)
  if (userIds.length === 0) {
    return NextResponse.json({ error: 'user_ids must be a non-empty array' }, { status: 400 })
  }

  const result = await disconnectVoicemasterMembers(id, channelId, userIds)
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error || 'Failed to disconnect members' },
      { status: 502 }
    )
  }

  const channels = await getEnrichedChannels(id)

  recordDashboardAudit(session, id, 'voicemaster.member.disconnect', {
    channel_id: channelId,
    user_ids: userIds,
    disconnected_user_ids: result.disconnected_user_ids ?? [],
    failed_user_ids: result.failed_user_ids ?? [],
  })

  return NextResponse.json({
    ok: true,
    channels,
    disconnected_user_ids: result.disconnected_user_ids ?? [],
    failed_user_ids: result.failed_user_ids ?? [],
  })
}
