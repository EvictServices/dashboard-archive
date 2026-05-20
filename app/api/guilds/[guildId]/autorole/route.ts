import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { hasGuildAdmin } from '@elira/lib/discord/api'
import { fetchGuildMember, fetchGuildRoles } from '@elira/lib/cluster/client'
import {
  getDangerousPermissions,
  permissionLabel,
} from '@elira/lib/discord/permissions'
import {
  ACTIONS,
  AutoroleAction,
  MAX_DELAY,
  MIN_DELAY,
  addAutorole,
  clearAutoroles,
  getAutoroleSettings,
  removeAutorole,
  setReassignIgnoreIds,
  setReassignRoles,
} from '@/lib/settings/autorole'
import { recordDashboardAudit } from '@/lib/settings/dashboard-audit'

function isSnowflake(value: unknown): value is string {
  return typeof value === 'string' && /^\d{15,21}$/.test(value)
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

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const op = typeof body.op === 'string' ? body.op : null

  try {
    switch (op) {
      case 'add': {
        if (!isSnowflake(body.role_id)) {
          return NextResponse.json({ error: 'role_id is required' }, { status: 400 })
        }
        if (typeof body.action !== 'string' || !ACTIONS.includes(body.action as AutoroleAction)) {
          return NextResponse.json({ error: 'action must be "add" or "remove"' }, { status: 400 })
        }
        const action = body.action as AutoroleAction
        let delay: number | null = null
        if (body.delay !== null && body.delay !== undefined && body.delay !== '') {
          delay = Number(body.delay)
          if (!Number.isFinite(delay) || delay < MIN_DELAY || delay > MAX_DELAY) {
            return NextResponse.json(
              { error: `Delay must be between ${MIN_DELAY} and ${MAX_DELAY} seconds` },
              { status: 400 }
            )
          }
        }

        const [guildRoles, member] = await Promise.all([
          fetchGuildRoles(id).catch(() => null),
          fetchGuildMember(id, session.userId),
        ])

        const targetRole = guildRoles?.find((r) => r.id === body.role_id)
        if (!targetRole) {
          return NextResponse.json(
            { error: 'Role not found in this server' },
            { status: 400 }
          )
        }

        if (
          targetRole.managed ||
          targetRole.is_default ||
          targetRole.is_bot_managed ||
          targetRole.is_premium_subscriber ||
          targetRole.is_integration
        ) {
          return NextResponse.json(
            { error: 'That role cannot be assigned automatically' },
            { status: 400 }
          )
        }

        if (!member) {
          return NextResponse.json(
            { error: 'Could not verify your roles in this server. Try again in a moment.' },
            { status: 400 }
          )
        }

        if (!member.is_owner && targetRole.position >= member.top_role_position) {
          return NextResponse.json(
            {
              error:
                'You can only configure auto roles below your highest role. Move that role above this one or pick a lower role.',
            },
            { status: 400 }
          )
        }

        const dangerous = getDangerousPermissions(targetRole.permissions)
        if (dangerous.length > 0) {
          const labels = dangerous.map(permissionLabel).join(', ')
          return NextResponse.json(
            {
              error: `That role has dangerous permissions (${labels}) and cannot be used as an auto role.`,
            },
            { status: 400 }
          )
        }

        await addAutorole(id, body.role_id, action, delay)
        recordDashboardAudit(session, id, 'autorole.add', {
          role_id: body.role_id,
          action,
          delay,
        })
        break
      }
      case 'remove': {
        if (!isSnowflake(body.role_id)) {
          return NextResponse.json({ error: 'role_id is required' }, { status: 400 })
        }
        const action =
          typeof body.action === 'string' && ACTIONS.includes(body.action as AutoroleAction)
            ? (body.action as AutoroleAction)
            : undefined
        const removed = await removeAutorole(id, body.role_id, action)
        if (!removed) {
          return NextResponse.json({ error: 'No matching auto role found' }, { status: 404 })
        }
        recordDashboardAudit(session, id, 'autorole.remove', {
          role_id: body.role_id,
          action: action ?? null,
        })
        break
      }
      case 'clear': {
        await clearAutoroles(id)
        recordDashboardAudit(session, id, 'autorole.clear', {})
        break
      }
      case 'reassign': {
        if (typeof body.enabled !== 'boolean') {
          return NextResponse.json({ error: 'enabled must be a boolean' }, { status: 400 })
        }
        await setReassignRoles(id, body.enabled)
        recordDashboardAudit(session, id, 'autorole.reassign', { enabled: body.enabled })
        break
      }
      case 'reassign_ignore': {
        if (!Array.isArray(body.role_ids) || !body.role_ids.every(isSnowflake)) {
          return NextResponse.json({ error: 'role_ids must be an array of role IDs' }, { status: 400 })
        }
        await setReassignIgnoreIds(id, body.role_ids as string[])
        recordDashboardAudit(session, id, 'autorole.reassign_ignore', {
          role_ids_count: body.role_ids.length,
        })
        break
      }
      default:
        return NextResponse.json({ error: 'Unknown op' }, { status: 400 })
    }
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to update autorole settings' },
      { status: 400 }
    )
  }

  const settings = await getAutoroleSettings(id)
  return NextResponse.json(settings)
}
