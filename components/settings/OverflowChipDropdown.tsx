'use client'

import { useEffect, useRef, useState } from 'react'

export function OverflowChipDropdown({
  count,
  ids,
  getRowLabel,
  disabled,
  onRemoveOne,
  ariaMoreLabel = 'Show more',
}: {
  count: number
  ids: string[]
  getRowLabel: (id: string) => string
  disabled?: boolean
  onRemoveOne: (id: string) => void
  ariaMoreLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (count <= 0 || ids.length === 0) return null

  return (
    <div className="disabled-commands-overflow-wrap" ref={wrapRef}>
      <button
        type="button"
        className="disabled-commands-chip disabled-commands-chip--overflow disabled-commands-overflow-trigger"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`${ariaMoreLabel} (${count})`}
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
      >
        +{count}
      </button>
      {open && (
        <div className="disabled-commands-overflow-menu" role="listbox">
          {ids.map((cid) => {
            const label = getRowLabel(cid)
            return (
              <div key={cid} className="disabled-commands-overflow-row" role="option">
                <span className="disabled-commands-overflow-name">{label}</span>
                <button
                  type="button"
                  className="disabled-commands-overflow-remove"
                  aria-label={`Remove ${label}`}
                  disabled={disabled}
                  onClick={() => {
                    onRemoveOne(cid)
                    setOpen(false)
                  }}
                >
                  -
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
