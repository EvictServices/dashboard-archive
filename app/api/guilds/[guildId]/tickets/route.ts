import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@elira/lib/auth/session'
import { hasGuildAdmin } from '@elira/lib/discord/api'
import {
  getTicketSettings,
  setTicketChannelNameTemplate,
  setTicketLogsChannel,
  addTicketStaffRole,
  removeTicketStaffRole,
  addTicketBlacklist,
  removeTicketBlacklist,
  setTicketButtonTemplate,
  setTicketButtonCategory,
  deleteTicketButton,
} from '@/lib/settings/tickets'
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

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const op = typeof body.op === 'string' ? body.op : ''

  try {
    switch (op) {
      case 'set_channel_name': {
        const channelName =
          body.channel_name === null || body.channel_name === undefined
            ? null
            : String(body.channel_name)
        if (channelName !== null && channelName.length > 100) {
          return NextResponse.json(
            { error: 'Channel name template must be at most 100 characters' },
            { status: 400 }
          )
        }
        await setTicketChannelNameTemplate(id, channelName)
        recordDashboardAudit(session, id, 'tickets.channel_name', { channel_name: channelName })
        break
      }
      case 'set_logs_channel': {
        const channelId =
          body.channel_id === null || body.channel_id === undefined || body.channel_id === ''
            ? null
            : String(body.channel_id)
        await setTicketLogsChannel(id, channelId)
        recordDashboardAudit(session, id, 'tickets.logs_channel', { channel_id: channelId })
        break
      }
      case 'add_staff': {
        const roleId = String(body.role_id ?? '')
        await addTicketStaffRole(id, roleId)
        recordDashboardAudit(session, id, 'tickets.staff_add', { role_id: roleId })
        break
      }
      case 'remove_staff': {
        const roleId = String(body.role_id ?? '')
        await removeTicketStaffRole(id, roleId)
        recordDashboardAudit(session, id, 'tickets.staff_remove', { role_id: roleId })
        break
      }
      case 'add_blacklist': {
        const targetId = String(body.target_id ?? '')
        await addTicketBlacklist(id, targetId)
        recordDashboardAudit(session, id, 'tickets.blacklist_add', { target_id: targetId })
        break
      }
      case 'remove_blacklist': {
        const targetId = String(body.target_id ?? '')
        await removeTicketBlacklist(id, targetId)
        recordDashboardAudit(session, id, 'tickets.blacklist_remove', { target_id: targetId })
        break
      }
      case 'set_button_template': {
        const identifier = String(body.identifier ?? '')
        const template =
          body.template === null || body.template === undefined ? null : String(body.template)
        if (template !== null && template.length > 4000) {
          return NextResponse.json({ error: 'Template is too long' }, { status: 400 })
        }
        await setTicketButtonTemplate(id, identifier, template)
        recordDashboardAudit(session, id, 'tickets.button_template', {
          identifier,
          has_template: template != null,
        })
        break
      }
      case 'set_button_category': {
        const identifier = String(body.identifier ?? '')
        const categoryId =
          body.category_id === null || body.category_id === undefined || body.category_id === ''
            ? null
            : String(body.category_id)
        await setTicketButtonCategory(id, identifier, categoryId)
        recordDashboardAudit(session, id, 'tickets.button_category', {
          identifier,
          category_id: categoryId,
        })
        break
      }
      case 'delete_button': {
        const identifier = String(body.identifier ?? '')
        await deleteTicketButton(id, identifier)
        recordDashboardAudit(session, id, 'tickets.button_delete', { identifier })
        break
      }
      default:
        return NextResponse.json({ error: 'Unknown op' }, { status: 400 })
    }
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 400 }
    )
  }

  const updated = await getTicketSettings(id)
  return NextResponse.json(updated)
}
