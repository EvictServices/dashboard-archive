import { apiGuild } from '@elira/lib/routes'

export type BundleResource =
  | 'system'
  | 'boost'
  | 'goodbye'
  | 'channels'
  | 'autorole'
  | 'roles'
  | 'me'
  | 'logging'
  | 'tickets'
  | 'voicemaster'
  | 'voicemaster_channels'

export interface BundleResponse {
  system?: { messages: unknown[]; unavailable?: boolean }
  boost?: { messages: unknown[]; unavailable?: boolean }
  goodbye?: { messages: unknown[]; unavailable?: boolean }
  channels?: unknown[]
  autorole?: unknown
  roles?: unknown[]
  me?: unknown
  logging?: unknown
  tickets?: unknown
  voicemaster?: { configuration: unknown }
  voicemaster_channels?: { channels: unknown[] }
}

interface PendingRequest {
  guildId: string
  resources: BundleResource[]
  resolve: (data: BundleResponse) => void
  reject: (err: unknown) => void
}

let pending: PendingRequest[] = []
let scheduled = false

function flush(): void {
  scheduled = false
  const drained = pending
  pending = []

  const byGuild = new Map<string, PendingRequest[]>()
  for (const req of drained) {
    const list = byGuild.get(req.guildId) ?? []
    list.push(req)
    byGuild.set(req.guildId, list)
  }

  for (const [guildId, list] of byGuild) {
    const union = Array.from(
      new Set(list.flatMap((req) => req.resources))
    ).sort()
    const url = `${apiGuild(guildId, 'bundle')}?include=${encodeURIComponent(union.join(','))}`

    fetch(url, { credentials: 'same-origin' })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Bundle request failed: ${response.status}`)
        }
        return (await response.json()) as BundleResponse
      })
      .then(
        (data) => {
          for (const req of list) req.resolve(data)
        },
        (err) => {
          for (const req of list) req.reject(err)
        }
      )
  }
}

export function fetchBundle(
  guildId: string,
  resources: BundleResource[]
): Promise<BundleResponse> {
  return new Promise<BundleResponse>((resolve, reject) => {
    pending.push({ guildId, resources, resolve, reject })
    if (!scheduled) {
      scheduled = true
      queueMicrotask(flush)
    }
  })
}
