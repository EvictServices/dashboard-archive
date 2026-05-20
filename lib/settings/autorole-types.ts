export const ACTIONS = ['add', 'remove'] as const
export type AutoroleAction = (typeof ACTIONS)[number]

export const MIN_DELAY = 1
export const MAX_DELAY = 160

export interface AutoroleEntry {
  role_id: string
  action: AutoroleAction
  delay: number | null
}

export interface AutoroleSettings {
  roles: AutoroleEntry[]
  reassign_roles: boolean
  reassign_ignore_ids: string[]
}
