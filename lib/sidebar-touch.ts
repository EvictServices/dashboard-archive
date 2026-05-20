/**
 * After closing the mobile settings drawer, the same touch can end on the
 * sticky "Menu" control behind it and reopen the drawer. Cooldown survives
 * React remounts (`key` on tab change) because it's module-level.
 */
let blockMenuOpenUntil = 0

export function armDashboardSidebarMenuCooldown(ms = 550) {
  blockMenuOpenUntil = Date.now() + ms
}

export function isDashboardSidebarMenuOpenBlocked() {
  return Date.now() < blockMenuOpenUntil
}
