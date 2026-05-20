export const TAG_REWARDS_DEFAULT_TEMPLATE =
  'thank you {user.mention} for representing **{guild.name}** on your profile'

export function vanityRewardsDefaultTemplate(vanitySlug: string): string {
  return `thank you {user.mention} for repping /${vanitySlug}`
}
