import type { GuildChannel } from '@elira/lib/cluster/client'

const TYPE_NAME_TO_CODE: Record<string, number> = {
  GUILD_TEXT: 0,
  GUILD_NEWS: 5,
  ANNOUNCEMENT: 5,
  GUILD_VOICE: 2,
  GUILD_STAGE_VOICE: 13,
  GUILD_CATEGORY: 4,
  GUILD_FORUM: 15,
}

function discordChannelTypeCode(type: GuildChannel['type']): number | null {
  if (type === undefined || type === null) return null
  if (typeof type === 'number' && !Number.isNaN(type)) return type
  if (typeof type === 'string') {
    const t = type.trim()
    switch (t) {
      case 'text':
        return 0
      case 'news':
        return 5
      case 'voice':
        return 2
      case 'stage_voice':
        return 13
      case 'category':
        return 4
      default: {
        const key = t.toUpperCase().replace(/-/g, '_')
        const mapped = TYPE_NAME_TO_CODE[key]
        if (mapped !== undefined) return mapped
        const n = parseInt(t, 10)
        return Number.isNaN(n) ? null : n
      }
    }
  }
  return null
}

export function isDiscordCategoryChannel(c: GuildChannel): boolean {
  return discordChannelTypeCode(c.type) === 4
}

export function isDiscordTextChannel(c: GuildChannel): boolean {
  const n = discordChannelTypeCode(c.type)
  return n === 0 || n === 5
}

export function isDiscordVoiceChannel(c: GuildChannel): boolean {
  const n = discordChannelTypeCode(c.type)
  return n === 2 || n === 13
}
