'use client'

import { useState, useEffect, useRef } from 'react'
import { VARIABLES } from '@/lib/embeds/constants'

const ALL_VARS = VARIABLES.flatMap(c => c.vars)

interface AutocompleteProps {
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>
  onInsert: (variable: string) => void
}

export default function Autocomplete({ inputRef, onInsert }: AutocompleteProps) {
  const [suggestions, setSuggestions] = useState<{ name: string, desc: string }[]>([])
  const [selected, setSelected] = useState(0)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleInput = () => {
      const el = inputRef.current
      if (!el) return
      const cursor = el.selectionStart ?? 0
      const text = el.value.slice(0, cursor)
      const match = text.match(/\{([a-z._]*)$/i)

      if (match) {
        const query = match[1].toLowerCase()
        const filtered = ALL_VARS.filter(v => v.name.toLowerCase().includes(query))
        setSuggestions(filtered.slice(0, 8))
        setSelected(0)

        const rect = el.getBoundingClientRect()
        setPosition({ top: rect.bottom + 4, left: rect.left })
      } else {
        setSuggestions([])
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (suggestions.length === 0) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelected(s => Math.min(s + 1, suggestions.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelected(s => Math.max(s - 1, 0))
      } else if (e.key === 'Tab' || e.key === 'Enter') {
        if (suggestions.length > 0) {
          e.preventDefault()
          acceptSuggestion(suggestions[selected].name)
        }
      } else if (e.key === 'Escape') {
        setSuggestions([])
      }
    }

    const acceptSuggestion = (variable: string) => {
      const el = inputRef.current
      if (!el) return
      const cursor = el.selectionStart ?? 0
      const text = el.value
      const match = text.slice(0, cursor).match(/\{([a-z._]*)$/i)
      if (!match) return

      const start = cursor - match[0].length
      const newValue = text.slice(0, start) + variable + text.slice(cursor)
      const proto = el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
      if (setter) {
        setter.call(el, newValue)
        el.dispatchEvent(new Event('input', { bubbles: true }))
      }
      el.focus()
      const newCursor = start + variable.length
      el.setSelectionRange(newCursor, newCursor)
      setSuggestions([])
    }

    document.addEventListener('input', handleInput, true)
    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('input', handleInput, true)
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [inputRef, suggestions, selected, onInsert])

  if (suggestions.length === 0) return null

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        zIndex: 9999,
        background: '#1e1f22',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '8px',
        padding: '0.25rem',
        minWidth: '200px',
        maxHeight: '240px',
        overflowY: 'auto',
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
      }}
    >
      {suggestions.map((v, i) => (
        <div
          key={v.name}
          onMouseDown={e => {
            e.preventDefault()
            const el = inputRef.current
            if (!el) return
            const cursor = el.selectionStart ?? 0
            const text = el.value
            const match = text.slice(0, cursor).match(/\{([a-z._]*)$/i)
            if (!match) return
            const start = cursor - match[0].length
            const newValue = text.slice(0, start) + v.name + text.slice(cursor)
            const proto = el instanceof HTMLTextAreaElement
              ? HTMLTextAreaElement.prototype
              : HTMLInputElement.prototype
            const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
            if (setter) {
              setter.call(el, newValue)
              el.dispatchEvent(new Event('input', { bubbles: true }))
            }
            el.focus()
            const newCursor = start + v.name.length
            el.setSelectionRange(newCursor, newCursor)
            setSuggestions([])
          }}
          style={{
            padding: '0.4rem 0.6rem',
            borderRadius: '4px',
            color: i === selected ? '#fff' : 'rgba(255,255,255,0.6)',
            background: i === selected ? 'rgba(88,101,242,0.3)' : 'transparent',
            fontSize: '0.8rem',
            cursor: 'pointer',
            transition: 'background 0.1s',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
          }}
          onMouseEnter={() => setSelected(i)}
        >
          <span style={{ fontFamily: 'monospace' }}>{v.name}</span>
          <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>{v.desc}</span>
        </div>
      ))}
    </div>
  )
}
