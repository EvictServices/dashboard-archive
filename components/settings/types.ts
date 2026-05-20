export interface GuildChannel {
  id: string
  name: string
  type: number | string
  position: number
  parent_id: string | null
}

export interface GuildRole {
  id: string
  name: string
  color: number
  position: number
  managed: boolean
  permissions?: string
  is_bot_managed?: boolean
  is_premium_subscriber?: boolean
  is_integration?: boolean
}

export interface GuildMemberInfo {
  is_owner: boolean
  top_role_position: number
  role_ids: string[]
  permissions: string
}

export function colorHex(color: number): string | null {
  if (!color) return null
  return `#${color.toString(16).padStart(6, '0')}`
}
