export const REGIONS = [
  'brazil',
  'hongkong',
  'india',
  'japan',
  'rotterdam',
  'russia',
  'singapore',
  'south-korea',
  'southafrica',
  'sydney',
  'us-central',
  'us-east',
  'us-south',
  'us-west',
] as const

export type Region = (typeof REGIONS)[number]

export const MIN_BITRATE_KBPS = 8
export const MAX_BITRATE_KBPS = 384

export interface VoicemasterConfiguration {
  guild_id: string
  category_id: string | null
  interface_id: string | null
  channel_id: string | null
  role_id: string | null
  region: Region | null
  bitrate: number | null
  interface_layout: string
}

export interface VoicemasterChannel {
  guild_id: string
  channel_id: string
  owner_id: string | null
}

export interface VoicemasterConnectedMember {
  user_id: string
  username: string | null
  display_name: string | null
  avatar: string | null
}

export interface EnrichedVoicemasterChannel {
  guild_id: string
  channel_id: string
  owner_id: string | null
  name: string | null
  member_count: number | null
  bitrate: number | null
  user_limit: number | null
  exists: boolean
  owner_username: string | null
  owner_display_name: string | null
  owner_avatar: string | null
  connected_members: VoicemasterConnectedMember[]
}
