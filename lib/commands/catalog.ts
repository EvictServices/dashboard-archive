export interface CatalogCommand {
  name: string
  description: string
  category: string
}

export function parseCommandsCatalog(data: unknown): CatalogCommand[] {
  const cmdMap =
    (data as { data?: { commands?: unknown } })?.data?.commands ??
    (data as { commands?: unknown })?.commands ??
    data

  const raw: CatalogCommand[] = []
  if (typeof cmdMap === 'object' && cmdMap !== null && !Array.isArray(cmdMap)) {
    Object.entries(cmdMap as Record<string, unknown[]>).forEach(([category, cmds]) => {
      if (!Array.isArray(cmds)) return
      for (const cmd of cmds) {
        if (!cmd || typeof cmd !== 'object') continue
        const row = cmd as Record<string, unknown>
        if (row.hidden === true) continue
        if ((category || '').toLowerCase() === 'jishaku') continue
        const name =
          (typeof row.qualified_name === 'string' && row.qualified_name.trim()) ||
          (typeof row.name === 'string' && row.name.trim()) ||
          ''
        if (!name) continue
        raw.push({
          name,
          description:
            (typeof row.description === 'string' && row.description.trim()) ||
            (typeof row.help === 'string' && row.help.trim()) ||
            '',
          category: category || 'Uncategorized',
        })
      }
    })
  }

  const seen = new Set<string>()
  return raw
    .filter((c) => {
      if (seen.has(c.name)) return false
      seen.add(c.name)
      return true
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function groupCommandsByCategory(
  commands: CatalogCommand[]
): { category: string; commands: CatalogCommand[] }[] {
  const byCat = new Map<string, CatalogCommand[]>()
  for (const c of commands) {
    const cat = c.category || 'Uncategorized'
    if (!byCat.has(cat)) byCat.set(cat, [])
    byCat.get(cat)!.push(c)
  }
  return [...byCat.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, cmds]) => ({
      category,
      commands: [...cmds].sort((a, b) => a.name.localeCompare(b.name)),
    }))
}

export function filterCommandsCatalog(
  commands: CatalogCommand[],
  query: string
): CatalogCommand[] {
  const q = query.trim().toLowerCase()
  if (!q) return commands
  return commands.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q)
  )
}
