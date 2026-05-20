/** Client-safe types and limits for rewards (tag / vanity). DB access lives in `rewards.ts`. */

export const MAX_TAG_REWARD_ROLES = 15

export interface TagRewardsState {
  channel_id: string | null
  role_ids: string[]
  template: string | null
}

export interface VanityRewardsState {
  channel_id: string | null
  role_id: string | null
  template: string | null
}
