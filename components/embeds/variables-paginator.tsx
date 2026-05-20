'use client'

import { useState } from 'react'
import { VARIABLES } from '@/lib/embeds/constants'

const PER_PAGE = 8

export default function VariablesPaginator({ onInsert }: { onInsert?: (variable: string) => void }) {
  const [tab, setTab] = useState(0)
  const [varPage, setVarPage] = useState(0)
  const current = VARIABLES[tab]
  const totalPages = Math.ceil(current.vars.length / PER_PAGE)
  const visible = current.vars.slice(varPage * PER_PAGE, (varPage + 1) * PER_PAGE)

  const switchTab = (i: number) => {
    setTab(i)
    setVarPage(0)
  }

  return (
    <div>
      <div style={{
        display: 'flex', gap: '0.25rem', marginBottom: '0.75rem',
        borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.4rem',
      }}>
        {VARIABLES.map((cat, i) => (
          <button
            key={cat.category}
            onClick={() => switchTab(i)}
            style={{
              padding: '0.3rem 0.7rem',
              background: i === tab ? 'rgba(88,101,242,0.12)' : 'transparent',
              border: i === tab ? '1px solid rgba(88,101,242,0.25)' : '1px solid transparent',
              borderRadius: '100px',
              color: i === tab ? '#8b9eff' : 'rgba(255,255,255,0.35)',
              fontSize: '0.72rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              letterSpacing: '0.02em',
            }}
          >
            {cat.category}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', minHeight: '52px' }}>
        {visible.map(v => (
          <span
            key={v.name}
            onClick={() => onInsert ? onInsert(v.name) : navigator.clipboard.writeText(v.name)}
            className="embed-var-chip"
            style={{
              padding: '0.25rem 0.55rem',
              background: 'rgba(0,0,0,0.3)',
              borderRadius: '6px',
              color: 'rgba(255,255,255,0.55)',
              fontSize: '0.7rem',
              fontFamily: '"SF Mono", "Fira Code", monospace',
              cursor: 'pointer',
              border: '1px solid rgba(255,255,255,0.05)',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(88,101,242,0.12)'
              e.currentTarget.style.color = '#8b9eff'
              e.currentTarget.style.borderColor = 'rgba(88,101,242,0.25)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(0,0,0,0.3)'
              e.currentTarget.style.color = 'rgba(255,255,255,0.55)'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'
            }}
            title={v.desc}
          >
            {v.name}
          </span>
        ))}
      </div>

      {totalPages > 1 && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginTop: '0.5rem', paddingTop: '0.4rem',
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}>
          <button
            onClick={() => setVarPage(p => Math.max(0, p - 1))}
            disabled={varPage === 0}
            style={{
              padding: '0.2rem 0.5rem', background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px',
              color: varPage === 0 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.6)',
              fontSize: '0.7rem', cursor: varPage === 0 ? 'default' : 'pointer',
            }}
          >
            ←
          </button>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.65rem' }}>
            {varPage + 1} / {totalPages}
          </span>
          <button
            onClick={() => setVarPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={varPage === totalPages - 1}
            style={{
              padding: '0.2rem 0.5rem', background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px',
              color: varPage === totalPages - 1 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.6)',
              fontSize: '0.7rem', cursor: varPage === totalPages - 1 ? 'default' : 'pointer',
            }}
          >
            →
          </button>
        </div>
      )}
    </div>
  )
}
