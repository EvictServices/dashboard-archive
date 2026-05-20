export const INVOKE_ACTION_TYPES = [
  'kicked',
  'banned',
  'muted',
  'unmuted',
  'warned',
  'jailed',
  'unjailed',
  'role_added',
  'role_removed',
] as const

export type InvokeActionType = (typeof INVOKE_ACTION_TYPES)[number]

export function isInvokeActionType(v: string): v is InvokeActionType {
  return (INVOKE_ACTION_TYPES as ReadonlyArray<string>).includes(v)
}

export const INVOKE_ACTION_LABELS: Record<InvokeActionType, string> = {
  kicked: 'Kick',
  banned: 'Ban',
  muted: 'Mute',
  unmuted: 'Unmute',
  warned: 'Warn',
  jailed: 'Jail',
  unjailed: 'Unjail',
  role_added: 'Role added',
  role_removed: 'Role removed',
}

export const INVOKE_DEFAULT_MESSAGE: Record<InvokeActionType, string> = {
  kicked: 'Successfully kicked {user.mention}',
  banned: 'Successfully banned {user.mention}',
  muted: 'Successfully muted {user.mention}',
  unmuted: 'Successfully unmuted {user.mention}',
  warned: 'Successfully warned {user.mention}',
  jailed: 'Successfully jailed {user.mention}',
  unjailed: 'Successfully unjailed {user.mention}',
  role_added: 'Successfully role_added {user.mention}',
  role_removed: 'Successfully role_removed {user.mention}',
}
