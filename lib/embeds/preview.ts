export interface PreviewUser {
  id?: string
  name?: string
  display_name?: string
  avatar_url?: string
}

export interface PreviewGuild {
  id?: string
  name?: string
  icon_url?: string | null
  banner_url?: string | null
  member_count?: number
}

export interface PreviewChannel {
  id?: string
  name?: string
}

export interface PreviewContext {
  user?: PreviewUser
  moderator?: PreviewUser
  guild?: PreviewGuild
  channel?: PreviewChannel
}

const DEFAULT_USER_AVATAR = 'https://cdn.discordapp.com/embed/avatars/0.png'
const DEFAULT_MODERATOR_AVATAR = 'https://cdn.discordapp.com/embed/avatars/1.png'
const DEFAULT_GUILD_ICON = 'https://cdn.discordapp.com/embed/avatars/3.png'

type ResolvedVariableKind = 'mention' | 'channel' | 'role' | 'text' | 'url' | 'unknown'

interface ResolvedVariable {
  kind: ResolvedVariableKind
  value: string
}

/**
 * Resolve a template variable path (e.g. `user.avatar`, `guild.icon`) for preview rendering.
 * Returns a kind so the caller can style mentions/channels distinctly, and an example value
 * for unknown paths so the preview never blows up — the bot is the source of truth at send time.
 */
export function resolveVariable(path: string, ctx?: PreviewContext): ResolvedVariable {
  const u = ctx?.user
  const m = ctx?.moderator
  const g = ctx?.guild
  const c = ctx?.channel

  switch (path) {
    case 'user':
    case 'user.name':
      return { kind: 'text', value: u?.name || 'user' }
    case 'user.display_name':
      return { kind: 'text', value: u?.display_name || u?.name || 'User' }
    case 'user.id':
      return { kind: 'text', value: u?.id || '000000000000000000' }
    case 'user.mention':
      return { kind: 'mention', value: `@${u?.name || 'user'}` }
    case 'user.avatar':
    case 'user.display_avatar':
    case 'user.guild_avatar':
      return { kind: 'url', value: u?.avatar_url || DEFAULT_USER_AVATAR }
    case 'user.discriminator':
      return { kind: 'text', value: '0000' }
    case 'user.color':
      return { kind: 'text', value: '#5865f2' }
    case 'user.top_role':
      return { kind: 'text', value: 'Member' }
    case 'user.role_list':
      return { kind: 'text', value: 'Member, Verified' }
    case 'user.join_position':
      return { kind: 'text', value: '1' }
    case 'user.join_position_suffix':
      return { kind: 'text', value: '1st' }
    case 'user.bot':
      return { kind: 'text', value: 'false' }
    case 'user.boost':
      return { kind: 'text', value: 'false' }

    case 'moderator':
    case 'moderator.mention':
      return { kind: 'mention', value: `@${m?.name || 'moderator'}` }
    case 'moderator.name':
      return { kind: 'text', value: m?.name || 'moderator' }
    case 'moderator.display_name':
      return { kind: 'text', value: m?.display_name || m?.name || 'Moderator' }
    case 'moderator.id':
      return { kind: 'text', value: m?.id || '000000000000000000' }
    case 'moderator.avatar':
    case 'moderator.display_avatar':
      return { kind: 'url', value: m?.avatar_url || DEFAULT_MODERATOR_AVATAR }

    case 'guild':
    case 'guild.name':
      return { kind: 'text', value: g?.name || 'Server Name' }
    case 'guild.id':
      return { kind: 'text', value: g?.id || '000000000000000000' }
    case 'guild.icon':
      return { kind: 'url', value: g?.icon_url || DEFAULT_GUILD_ICON }
    case 'guild.banner':
      return { kind: 'url', value: g?.banner_url || DEFAULT_GUILD_ICON }
    case 'guild.count':
    case 'guild.member_count':
      return { kind: 'text', value: g?.member_count != null ? g.member_count.toLocaleString() : '1,234' }
    case 'guild.boost_count':
      return { kind: 'text', value: '12' }
    case 'guild.boost_tier':
      return { kind: 'text', value: '2' }
    case 'guild.owner_id':
      return { kind: 'text', value: g?.id || '000000000000000000' }
    case 'guild.emoji_count':
      return { kind: 'text', value: '24' }
    case 'guild.role_count':
      return { kind: 'text', value: '18' }
    case 'guild.channels_count':
      return { kind: 'text', value: '32' }

    case 'channel':
    case 'channel.mention':
      return { kind: 'channel', value: `#${c?.name || 'channel'}` }
    case 'channel.name':
      return { kind: 'text', value: c?.name || 'channel' }
    case 'channel.id':
      return { kind: 'text', value: c?.id || '000000000000000000' }

    case 'reason':
      return { kind: 'text', value: 'No reason provided' }

    default:
      return { kind: 'unknown', value: `{${path}}` }
  }
}

/**
 * If a URL input is purely a `{variable}` placeholder, swap it for the real (or example)
 * URL so `<img>` tags don't try to fetch the literal placeholder text.
 */
export function resolveExampleImageUrl(url: string, ctx?: PreviewContext): string {
  if (!url) return url
  const trimmed = url.trim()
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return url
  const path = trimmed.slice(1, -1).trim()
  if (!/^[a-z_]+(?:\.[a-z_]+)*$/i.test(path)) return url
  const resolved = resolveVariable(path, ctx)
  if (resolved.kind === 'url') return resolved.value
  if (resolved.kind === 'unknown') return url
  return resolved.value
}
