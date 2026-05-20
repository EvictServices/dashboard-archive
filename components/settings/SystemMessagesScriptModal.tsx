'use client'

import { useEffect, useRef, useState, type FocusEvent } from 'react'
import { createPortal } from 'react-dom'
import EmbedEditor from '@/components/embeds/embed-editor'
import EmbedPreview from '@/components/embeds/embed-preview'
import VariablesPaginator from '@/components/embeds/variables-paginator'
import Autocomplete from '@/components/embeds/autocomplete'
import { generateScript, type EmbedButton, type EmbedData, type EmbedField } from '@/lib/embeds/types'
import type { ParsedEmbedPatch } from '@/lib/embeds/parse'
import type { PreviewContext } from '@/lib/embeds/preview'
import type { GuildChannel } from '@/components/settings/types'

function normalizeSnowflake(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'bigint') return String(v)
  if (typeof v === 'number' && Number.isFinite(v)) return String(Math.trunc(v))
  if (typeof v === 'string') {
    const t = v.trim()
    if (!t || t === 'null' || t === 'undefined') return ''
    return t
  }
  return String(v).trim()
}

export function categoryLabel(parentId: string | null, categoryById: Record<string, string>): string {
  const key = parentId ? normalizeSnowflake(parentId) : ''
  if (!key) return 'Uncategorized'
  const name = categoryById[key]
  if (name) return name
  return 'Uncategorized'
}

function WelcomeChannelDropdown({
  channels,
  value,
  onChange,
  placeholder,
  categoryById,
  disabled,
}: {
  channels: GuildChannel[]
  value: string
  onChange: (id: string) => void
  placeholder: string
  categoryById: Record<string, string>
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = channels.find((c) => c.id === value)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const empty = channels.length === 0

  return (
    <div className={`an-dropdown welcome-channel-dd${open ? ' open' : ''}`} ref={ref}>
      <button
        type="button"
        className="an-dropdown-trigger welcome-channel-dd-trigger"
        onClick={() => !disabled && !empty && setOpen(!open)}
        disabled={disabled || empty}
      >
        <span className="welcome-channel-dd-trigger-inner">
          {empty ? (
            <span className="welcome-channel-dd-placeholder">{placeholder}</span>
          ) : selected ? (
            <span className="welcome-channel-dd-row">
              <span className="welcome-channel-dd-name">#{selected.name}</span>
              <span className="welcome-channel-dd-cat">
                {categoryLabel(selected.parent_id, categoryById)}
              </span>
            </span>
          ) : (
            <span className="welcome-channel-dd-placeholder">{placeholder}</span>
          )}
        </span>
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
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && !empty && (
        <div className="an-dropdown-menu welcome-channel-dd-menu">
          {channels.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`an-dropdown-item welcome-channel-dd-item${c.id === value ? ' active' : ''}`}
              onClick={() => {
                onChange(c.id)
                setOpen(false)
              }}
            >
              <span className="welcome-channel-dd-item-inner welcome-channel-dd-row">
                <span className="welcome-channel-dd-name">#{c.name}</span>
                <span className="welcome-channel-dd-cat">{categoryLabel(c.parent_id, categoryById)}</span>
              </span>
              {c.id === value && (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="welcome-channel-dd-check"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const containerStyle = {
  background: 'rgba(255,255,255,0.025)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: '12px',
  overflow: 'hidden' as const,
  boxShadow: '0 4px 24px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.04) inset',
}

const headerStyle = {
  background: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
  padding: '0.75rem 1.05rem',
  borderBottom: '1px solid rgba(255,255,255,0.07)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
}

const headerTitle = {
  fontWeight: 700,
  fontSize: '0.88rem',
  color: '#fff',
  letterSpacing: '-0.01em',
}

const headerSub = {
  fontSize: '0.68rem',
  color: '#626876',
  fontWeight: 500,
}

export type ScriptEditorModalMode = 'add' | 'edit'

function appendDeleteAfter(template: string, seconds: number): string {
  const base = template.replace(/\s*--delete_after\s+(\d+)\s*$/i, '').trimEnd()
  return `${base} --delete_after ${seconds}`
}

export function ScriptEditorModal({
  open,
  mode,
  guildName,
  guildIconUrl,
  channels,
  categoryById,
  usedChannelIds,
  draftChannelId,
  setDraftChannelId,
  embed,
  saving,
  modalError,
  onClose,
  onSave,
  lastInputRef,
  handleEditorFocus,
  insertVariable,
  update,
  updateAuthor,
  updateFooter,
  addField,
  updateField,
  removeField,
  addButton,
  updateButton,
  removeButton,
  applyEmbedPatch,
  previewContext,
  titleAdd,
  titleEdit,
  channelHint,
  modalSubtitle = 'Choose a channel, then build the message.',
  showDeleteAfter,
  deleteAfterDraft,
  setDeleteAfterDraft,
}: {
  open: boolean
  mode: ScriptEditorModalMode
  guildName: string
  guildIconUrl: string | null
  channels: GuildChannel[]
  categoryById: Record<string, string>
  usedChannelIds: Set<string>
  draftChannelId: string
  setDraftChannelId: (id: string) => void
  embed: EmbedData
  saving: boolean
  modalError: string | null
  onClose: () => void
  onSave: () => void
  lastInputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>
  handleEditorFocus: (e: React.FocusEvent) => void
  insertVariable: (variable: string) => void
  update: <K extends keyof EmbedData>(key: K, value: EmbedData[K]) => void
  updateAuthor: (key: keyof EmbedData['author'], value: string) => void
  updateFooter: (key: keyof EmbedData['footer'], value: string) => void
  addField: () => void
  updateField: (index: number, key: keyof EmbedField, value: string | boolean) => void
  removeField: (index: number) => void
  addButton: () => void
  updateButton: (index: number, key: keyof EmbedButton, value: string | boolean) => void
  removeButton: (index: number) => void
  applyEmbedPatch: (patch: ParsedEmbedPatch) => void
  previewContext: PreviewContext
  titleAdd: string
  titleEdit: string
  channelHint: string
  modalSubtitle?: string
  showDeleteAfter: boolean
  deleteAfterDraft: string
  setDeleteAfterDraft: (s: string) => void
}) {
  const [mounted, setMounted] = useState(false)
  const [timeStr, setTimeStr] = useState('')

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (open) {
      setTimeStr(new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }))
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)

    const scrollY = window.scrollY
    const prev = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      left: document.body.style.left,
      right: document.body.style.right,
      width: document.body.style.width,
    }
    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.left = '0'
    document.body.style.right = '0'
    document.body.style.width = '100%'

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev.overflow
      document.body.style.position = prev.position
      document.body.style.top = prev.top
      document.body.style.left = prev.left
      document.body.style.right = prev.right
      document.body.style.width = prev.width
      window.scrollTo(0, scrollY)
    }
  }, [open, onClose])

  if (!mounted || !open) return null

  const freeChannels = channels.filter((c) => !usedChannelIds.has(c.id))
  const dropdownChannels =
    mode === 'edit'
      ? channels.filter((c) => !usedChannelIds.has(c.id) || c.id === draftChannelId)
      : freeChannels
  const previewAvatar = guildIconUrl || '/img/evict.webp'

  return createPortal(
    <>
      <Autocomplete inputRef={lastInputRef} onInsert={insertVariable} />
      <div
        className="welcome-modal-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-modal-title"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose()
        }}
      >
        <div className="welcome-modal-card" onClick={(e) => e.stopPropagation()}>
          <div className="welcome-modal-head">
            <div>
              <h2 id="welcome-modal-title" className="welcome-modal-title">
                {mode === 'add' ? titleAdd : titleEdit}
              </h2>
              <p className="welcome-modal-sub">{modalSubtitle}</p>
            </div>
            <button type="button" className="welcome-modal-close" onClick={onClose} aria-label="Close">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="welcome-modal-middle">
            <div className="welcome-modal-channel-pane">
              {modalError && <p className="settings-error welcome-modal-error">{modalError}</p>}

              <section className="welcome-modal-section" aria-labelledby="welcome-modal-channel-label">
                <h3 id="welcome-modal-channel-label" className="welcome-modal-h3">
                  Channel
                </h3>
                <p className="welcome-modal-hint">{channelHint}</p>
                <WelcomeChannelDropdown
                  channels={dropdownChannels}
                  value={draftChannelId}
                  onChange={setDraftChannelId}
                  placeholder="Select a text channel"
                  categoryById={categoryById}
                  disabled={saving}
                />
              </section>

              {showDeleteAfter && (
                <section className="welcome-modal-section" aria-labelledby="script-modal-delete-after-label">
                  <h3 id="script-modal-delete-after-label" className="welcome-modal-h3">
                    Auto-delete
                  </h3>
                  <p className="welcome-modal-hint">
                    Seconds before the message is removed. Leave empty to disable auto-delete.
                  </p>
                  <input
                    type="number"
                    min={0}
                    className="settings-input"
                    style={{ maxWidth: '12rem' }}
                    placeholder="e.g. 10"
                    value={deleteAfterDraft}
                    onChange={(e) => setDeleteAfterDraft(e.target.value)}
                    disabled={saving}
                  />
                </section>
              )}
            </div>

            <div className="welcome-modal-scroll">
            <section className="welcome-modal-section" aria-labelledby="welcome-modal-message-label">
              <h3 id="welcome-modal-message-label" className="welcome-modal-h3">
                Message
              </h3>
              <p className="welcome-modal-hint">Embed, content, variables, and buttons.</p>

              <div className="embed-grid welcome-modal-embed-grid">
                <div className="welcome-modal-embed-col">
                  <div className="embed-container" style={containerStyle}>
                    <div style={headerStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: '#5865f2',
                            boxShadow: '0 0 8px rgba(88,101,242,0.5)',
                          }}
                        />
                        <span style={headerTitle}>Editor</span>
                      </div>
                      <span style={headerSub}>Build message</span>
                    </div>
                    <div
                      style={{
                        padding: '1.1rem',
                        maxHeight: 'min(45vh, 420px)',
                        overflowY: 'auto',
                        overscrollBehavior: 'contain',
                        touchAction: 'pan-y',
                      }}
                      onFocusCapture={handleEditorFocus}
                    >
                      <EmbedEditor
                        data={embed}
                        update={update}
                        updateAuthor={updateAuthor}
                        updateFooter={updateFooter}
                        addField={addField}
                        updateField={updateField}
                        removeField={removeField}
                        addButton={addButton}
                        updateButton={updateButton}
                        removeButton={removeButton}
                        applyEmbedPatch={applyEmbedPatch}
                      />
                    </div>
                  </div>

                  <div className="embed-container" style={containerStyle}>
                    <div style={headerStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: '#faa61a',
                            boxShadow: '0 0 8px rgba(250,166,26,0.4)',
                          }}
                        />
                        <span style={headerTitle}>Variables</span>
                      </div>
                      <span style={headerSub}>Insert at cursor</span>
                    </div>
                    <div style={{ padding: '0.9rem' }}>
                      <VariablesPaginator onInsert={insertVariable} />
                    </div>
                  </div>
                </div>

                <div className="embed-grid-right welcome-modal-embed-col">
                  <div
                    className="embed-container"
                    style={{ ...containerStyle, background: '#313338', border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <div
                      style={{
                        ...headerStyle,
                        background: 'linear-gradient(135deg, rgba(88,101,242,0.08) 0%, rgba(0,0,0,0.15) 100%)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: '#57f287',
                            boxShadow: '0 0 8px rgba(87,242,135,0.5)',
                          }}
                        />
                        <span style={headerTitle}>Preview</span>
                      </div>
                      <span style={headerSub}>Approximate layout</span>
                    </div>
                    <div style={{ padding: '0.9rem' }}>
                      <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <img
                          src={previewAvatar}
                          alt=""
                          style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0 }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                            <span style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 600 }}>{guildName}</span>
                            <span
                              style={{
                                background: '#5865f2',
                                color: '#fff',
                                fontSize: '0.6rem',
                                padding: '0.1rem 0.3rem',
                                borderRadius: '3px',
                                fontWeight: 600,
                              }}
                            >
                              APP
                            </span>
                            {timeStr && (
                              <span style={{ color: '#a3a6aa', fontSize: '0.7rem' }}>Today at {timeStr}</span>
                            )}
                          </div>
                          <EmbedPreview data={embed} context={previewContext} />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="embed-container" style={containerStyle}>
                    <div style={headerStyle}>
                      <span style={headerTitle}>Stored script</span>
                      <span style={headerSub}>Saved format</span>
                    </div>
                    <div style={{ padding: '0.9rem' }}>
                      <pre className="welcome-script-pre welcome-modal-script-pre">
                        {(() => {
                          let s = generateScript(embed)
                          if (s && showDeleteAfter && deleteAfterDraft.trim() !== '') {
                            const n = parseInt(deleteAfterDraft.trim(), 10)
                            if (Number.isFinite(n) && n >= 0) {
                              s = appendDeleteAfter(s, n)
                            }
                          }
                          return s || '// Empty — add content or embed fields'
                        })()}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            </section>
            </div>
          </div>

          <div className="welcome-modal-footer">
            <button type="button" className="welcome-modal-btn ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button
              type="button"
              className="welcome-modal-btn primary"
              disabled={saving || !draftChannelId}
              onClick={onSave}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  )
}
