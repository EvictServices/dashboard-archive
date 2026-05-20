'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  filterCommandsCatalog,
  groupCommandsByCategory,
  type CatalogCommand,
} from '@/lib/commands/catalog'

function DropdownCheck() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="an-dropdown-channel-check"
      aria-hidden
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export function CommandModulePicker({
  commands,
  value,
  onChange,
  disabled,
  loading,
  placeholder = 'Pick a command…',
  emptyLabel = 'No commands available.',
  searchPlaceholder = 'Search commands…',
  'aria-labelledby': ariaLabelledBy,
}: {
  commands: CatalogCommand[]
  value: string
  onChange: (name: string) => void
  disabled?: boolean
  loading?: boolean
  placeholder?: string
  emptyLabel?: string
  searchPlaceholder?: string
  'aria-labelledby'?: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const ref = useRef<HTMLDivElement>(null)

  const locked = Boolean(disabled) || Boolean(loading)

  const filtered = useMemo(
    () => filterCommandsCatalog(commands, search),
    [commands, search]
  )

  const modules = useMemo(() => groupCommandsByCategory(filtered), [filtered])
  const selected = useMemo(
    () => commands.find((c) => c.name === value),
    [commands, value]
  )

  const searchActive = search.trim().length > 0

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (locked) setOpen(false)
  }, [locked])

  useEffect(() => {
    if (!searchActive) return
    const next: Record<string, boolean> = {}
    for (const m of modules) next[m.category] = true
    setExpanded(next)
  }, [searchActive, modules])

  const toggleModule = (category: string) => {
    setExpanded((prev) => ({ ...prev, [category]: !prev[category] }))
  }

  const pick = (name: string) => {
    onChange(name)
    setOpen(false)
    setSearch('')
  }

  if (loading) {
    return <p className="cmd-module-picker-status">Loading commands…</p>
  }

  if (commands.length === 0) {
    return <p className="cmd-module-picker-status">{emptyLabel}</p>
  }

  const triggerLabel = () => {
    if (!value) {
      return <span className="an-dropdown-channel-placeholder">{placeholder}</span>
    }
    return (
      <span className="an-dropdown-channel-row an-dropdown-channel-row--trigger">
        <span className="an-dropdown-command-name">{value}</span>
        {selected?.category ? (
          <span className="an-dropdown-channel-category">{selected.category}</span>
        ) : null}
      </span>
    )
  }

  return (
    <div
      className={`an-dropdown an-dropdown--command${open ? ' open' : ''}${locked ? ' disabled' : ''}`}
      ref={ref}
    >
      <button
        type="button"
        className="an-dropdown-trigger an-dropdown-trigger--channel"
        onClick={() => !locked && setOpen(!open)}
        disabled={locked}
        aria-labelledby={ariaLabelledBy}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="an-dropdown-trigger-channel-inner">{triggerLabel()}</span>
        <svg
          className="an-dropdown-chevron"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="an-dropdown-menu an-dropdown-menu--grouped" role="listbox" aria-label="Commands">
          <div className="an-dropdown-menu-search">
            <input
              type="search"
              className="an-dropdown-search-input"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={locked}
              aria-label="Search commands"
              autoFocus
            />
          </div>
          <div className="an-dropdown-menu-scroll">
            {searchActive ? (
              filtered.length === 0 ? (
                <p className="an-dropdown-empty">No commands match your search.</p>
              ) : (
                filtered.map((cmd) => {
                  const isSelected = cmd.name === value
                  return (
                    <button
                      key={cmd.name}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={`an-dropdown-item an-dropdown-item--channel${
                        isSelected ? ' active' : ''
                      }`}
                      title={cmd.description || undefined}
                      onClick={() => pick(cmd.name)}
                    >
                      <span className="an-dropdown-channel-row an-dropdown-channel-row--menu">
                        <span className="an-dropdown-command-name">{cmd.name}</span>
                        <span className="an-dropdown-channel-category">{cmd.category}</span>
                      </span>
                      {isSelected ? <DropdownCheck /> : null}
                    </button>
                  )
                })
              )
            ) : modules.length === 0 ? (
              <p className="an-dropdown-empty">No commands available.</p>
            ) : (
              modules.map((mod) => {
                const moduleOpen = expanded[mod.category] === true
                return (
                  <div key={mod.category} className="an-dropdown-group">
                    <button
                      type="button"
                      className="an-dropdown-group-head"
                      onClick={() => toggleModule(mod.category)}
                      aria-expanded={moduleOpen}
                    >
                      <span className="an-dropdown-group-title">{mod.category}</span>
                      <span className="an-dropdown-group-meta">
                        <span className="an-dropdown-group-count">{mod.commands.length}</span>
                        <svg
                          className={`an-dropdown-chevron${moduleOpen ? ' open' : ''}`}
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </span>
                    </button>
                    {moduleOpen &&
                      mod.commands.map((cmd) => {
                        const isSelected = cmd.name === value
                        return (
                          <button
                            key={cmd.name}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            className={`an-dropdown-item an-dropdown-item--command${
                              isSelected ? ' active' : ''
                            }`}
                            title={cmd.description || undefined}
                            onClick={() => pick(cmd.name)}
                          >
                            <span className="an-dropdown-command-name">{cmd.name}</span>
                            {isSelected ? <DropdownCheck /> : null}
                          </button>
                        )
                      })}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
