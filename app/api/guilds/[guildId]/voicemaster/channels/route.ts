import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { hasGuildAdmin } from '@elira/lib/discord/api'
import {
  getEnrichedChannels,
  deleteChannel,
  deleteChannels,
  deleteVoicemasterChannel,
  updateChannelOwner,
  type VoicemasterChannelDeleteResult,
} from '@/lib/settings/voicemaster'
import { fetchGuildChannels, type GuildChannel } from '@elira/lib/cluster/client'
import { recordDashboardAudit } from '@/lib/settings/dashboard-audit'

async function loadGuildVoiceState(guildId: string): Promise<{
  loaded: boolean
  channelIds: Set<string>
  memberCounts: Map<string, number>
}> {
  try {
    const live = await fetchGuildChannels(guildId)
    const channelIds = new Set<string>()
    const memberCounts = new Map<string, number>()
    for (const c of live) {
      const cid = String(c.id)
      channelIds.add(cid)
      const n = (c as GuildChannel & { member_count?: number }).member_count
      memberCounts.set(cid, typeof n === 'number' && !Number.isNaN(n) ? n : 0)
    }
    return { loaded: true, channelIds, memberCounts }
  } catch {
    return { loaded: false, channelIds: new Set(), memberCounts: new Map() }
  }
}

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

  const channels = await getEnrichedChannels(id)
  return NextResponse.json(
    { channels },
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

  const body = await req.json().catch(() => null)
  const channelId = body?.channel_id ? String(body.channel_id) : null
  const ownerId = body?.owner_id ? String(body.owner_id) : null

  if (!channelId || !ownerId) {
    return NextResponse.json(
      { error: 'channel_id and owner_id are required' },
      { status: 400 }
    )
  }

  await updateChannelOwner(channelId, ownerId)
  recordDashboardAudit(session, id, 'voicemaster.temp_channel.owner', {
    channel_id: channelId,
    owner_id: ownerId,
  })
  const channels = await getEnrichedChannels(id)
  return NextResponse.json({ channels })
}

export async function DELETE(
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

  const body = await req.json().catch(() => null)
  const mode = (body?.mode as string | undefined) ?? 'hard'

  if (Array.isArray(body?.channel_ids)) {
    const ids = body.channel_ids.map((cid: unknown) => String(cid))
    const failures: string[] = []
    let disconnectedMembersTotal = 0
    const disconnectedUserIds: string[] = []
    if (mode === 'hard') {
      const guildVo = await loadGuildVoiceState(id)
      const snapshot = guildVo.memberCounts
      for (const cid of ids) {
        const absent = guildVo.loaded && !guildVo.channelIds.has(cid)
        if (absent) {
          continue
        }
        const result = await deleteVoicemasterChannel(id, cid)
        if (!result?.ok) failures.push(cid)
        else {
          const fromBot =
            typeof result.disconnected_count === 'number'
              ? result.disconnected_count
              : result.disconnected_user_ids?.length
          const fallback = snapshot.get(cid)
          const n =
            typeof fromBot === 'number'
              ? fromBot
              : typeof fallback === 'number'
                ? fallback
                : undefined
          if (typeof n === 'number' && !Number.isNaN(n)) disconnectedMembersTotal += n
          if (result.disconnected_user_ids?.length) {
            disconnectedUserIds.push(...result.disconnected_user_ids)
          }
        }
      }
      const okIds = ids.filter((cid: string) => !failures.includes(cid))
      if (okIds.length > 0) await deleteChannels(okIds)
    } else {
      await deleteChannels(ids)
    }
    const bulkDetail: Record<string, unknown> = {
      count: ids.length,
      mode,
    }
    if (mode === 'hard') {
      bulkDetail.disconnected_members_total = disconnectedMembersTotal
      const uniqueUsers = [...new Set(disconnectedUserIds)]
      if (uniqueUsers.length > 0) {
        bulkDetail.disconnected_user_ids = uniqueUsers.slice(0, 200)
      }
    }
    recordDashboardAudit(session, id, 'voicemaster.temp_channels.delete_bulk', bulkDetail)
    const channels = await getEnrichedChannels(id)
    return NextResponse.json({
      channels,
      ...(failures.length > 0 && {
        warning: `Couldn't reach the bot for ${failures.length} channel(s)`,
      }),
    })
  }

  const channelId = body?.channel_id ? String(body.channel_id) : null
  if (!channelId) {
    return NextResponse.json(
      { error: 'channel_id or channel_ids is required' },
      { status: 400 }
    )
  }

  const deleteDetail: Record<string, unknown> = {
    channel_id: channelId,
    mode,
  }

  if (mode === 'hard') {
    const guildVo = await loadGuildVoiceState(id)
    const snapshot = guildVo.memberCounts
    const reportedInChannel = snapshot.get(channelId)
    const absent = guildVo.loaded && !guildVo.channelIds.has(channelId)

    let result: VoicemasterChannelDeleteResult | null = null
    if (absent) {
      deleteDetail.bot_skipped = 'channel_not_in_guild'
    } else {
      result = await deleteVoicemasterChannel(id, channelId)
      if (!result?.ok) {
        return NextResponse.json(
          {
            error:
              result?.error ||
              "Couldn't reach the bot to disconnect members. Set CLUSTER_API_URL if the bot API isn't on this host, or use soft delete.",
          },
          { status: 502 }
        )
      }
      const fromBot =
        typeof result.disconnected_count === 'number'
          ? result.disconnected_count
          : result.disconnected_user_ids?.length
      const disconnectedMembers =
        typeof fromBot === 'number'
          ? fromBot
          : typeof reportedInChannel === 'number'
            ? reportedInChannel
            : undefined
      if (typeof disconnectedMembers === 'number' && !Number.isNaN(disconnectedMembers)) {
        deleteDetail.disconnected_members = disconnectedMembers
        deleteDetail.disconnected_members_source =
          typeof fromBot === 'number' ? 'bot' : 'channel_snapshot'
      }
      if (result.disconnected_user_ids?.length) {
        deleteDetail.disconnected_user_ids = result.disconnected_user_ids.slice(0, 100)
      }
    }
    await deleteChannel(channelId)
  } else {
    await deleteChannel(channelId)
  }

  recordDashboardAudit(session, id, 'voicemaster.temp_channel.delete', deleteDetail)

  const channels = await getEnrichedChannels(id)
  return NextResponse.json({ channels })
}
