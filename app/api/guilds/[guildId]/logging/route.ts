import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@elira/lib/auth/session'
import { hasGuildAdmin } from '@elira/lib/discord/api'
import {
  getLoggingSettings,
  setLoggingEvents,
  setEventChannel,
  deleteLoggingChannel,
  addIgnored,
  removeIgnored,
  EVENT_TYPES,
  type EventType,
} from '@/lib/settings/logging'
import { recordDashboardAudit } from '@/lib/settings/dashboard-audit'

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

  if (body.event && typeof body.event === 'string') {
    const channelId = body.channel_id ? String(body.channel_id) : null
    try {
      await setEventChannel(id, body.event, channelId)
    } catch (err) {
      return NextResponse.json(
        { error: (err as Error).message },
        { status: 400 }
      )
    }
    recordDashboardAudit(session, id, 'logging.event_channel', {
      event: body.event,
      channel_id: channelId,
    })
    const updated = await getLoggingSettings(id)
    return NextResponse.json(updated)
  }

  if (body.channel_id && Array.isArray(body.events)) {
    const channelId = String(body.channel_id)
    const events = body.events as string[]
    const invalid = events.filter((e) => !EVENT_TYPES.includes(e as EventType))
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: `Invalid event types: ${invalid.join(', ')}` },
        { status: 400 }
      )
    }
    try {
      await setLoggingEvents(id, channelId, events)
    } catch (err) {
      return NextResponse.json(
        { error: (err as Error).message },
        { status: 400 }
      )
    }
    recordDashboardAudit(session, id, 'logging.channel_events', {
      channel_id: channelId,
      events_count: events.length,
    })
    const updated = await getLoggingSettings(id)
    return NextResponse.json(updated)
  }

  if (body.action === 'add_ignored' && body.target_id) {
    await addIgnored(id, String(body.target_id))
    recordDashboardAudit(session, id, 'logging.ignored_add', {
      target_id: String(body.target_id),
    })
    const updated = await getLoggingSettings(id)
    return NextResponse.json(updated)
  }

  if (body.action === 'remove_ignored' && body.target_id) {
    await removeIgnored(id, String(body.target_id))
    recordDashboardAudit(session, id, 'logging.ignored_remove', {
      target_id: String(body.target_id),
    })
    const updated = await getLoggingSettings(id)
    return NextResponse.json(updated)
  }

  return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
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

  const body = await req.json()

  if (!body.channel_id) {
    return NextResponse.json({ error: 'channel_id required' }, { status: 400 })
  }

  await deleteLoggingChannel(id, String(body.channel_id))
  recordDashboardAudit(session, id, 'logging.channel_remove', {
    channel_id: String(body.channel_id),
  })
  const updated = await getLoggingSettings(id)
  return NextResponse.json(updated)
}
