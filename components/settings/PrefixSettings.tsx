'use client'

import { useEffect, useState } from 'react'

export default function PrefixSettings({ guildId }: { guildId: string }) {
  const [prefix, setPrefix] = useState('')
  const [saved, setSaved] = useState('')
  const [roleplayEnabled, setRoleplayEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [rpSaving, setRpSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rpError, setRpError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setRpError(null)
    void (async () => {
      try {
        const [pr, rr] = await Promise.all([
          fetch(`/api/guilds/${guildId}/prefix`),
          fetch(`/api/guilds/${guildId}/roleplay`),
        ])
        const pj = await pr.json().catch(() => ({}))
        const rj = await rr.json().catch(() => ({}))
        if (cancelled) return
        if (pr.ok) {
          setPrefix(typeof pj.prefix === 'string' ? pj.prefix : ';')
          setSaved(typeof pj.prefix === 'string' ? pj.prefix : ';')
        } else {
          setError(typeof pj.error === 'string' ? pj.error : 'Failed to load prefix')
        }
        if (rr.ok) {
          setRoleplayEnabled(rj.enabled === true)
        } else {
          setRpError(typeof rj.error === 'string' ? rj.error : 'Failed to load roleplay setting')
        }
      } catch {
        if (!cancelled) setError('Failed to load settings')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [guildId])

  const handleSave = async () => {
    if (prefix === saved) return
    if (prefix.length < 1 || prefix.length > 7) {
      setError('Prefix must be between 1 and 7 characters')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/guilds/${guildId}/prefix`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefix }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to save')
        return
      }

      setSaved(prefix)
    } catch {
      setError('Failed to save prefix')
    } finally {
      setSaving(false)
    }
  }

  const toggleRoleplay = async () => {
    const next = !roleplayEnabled
    setRpSaving(true)
    setRpError(null)
    try {
      const res = await fetch(`/api/guilds/${guildId}/roleplay`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setRpError(typeof data.error === 'string' ? data.error : 'Failed to save')
        return
      }
      setRoleplayEnabled(data.enabled === true)
    } catch {
      setRpError('Failed to save roleplay setting')
    } finally {
      setRpSaving(false)
    }
  }

  if (loading) {
    return <div className="settings-loading">Loading...</div>
  }

  return (
    <div className="prefix-settings-pane">
      <div className="settings-field">
        <label className="settings-label">Server Prefix</label>
        <p className="settings-desc">
          The prefix used to trigger commands. Must be between 1 and 7 characters.
        </p>
        <div className="settings-input-row">
          <input
            type="text"
            className="settings-input"
            value={prefix}
            onChange={(e) => {
              setPrefix(e.target.value)
              setError(null)
            }}
            maxLength={7}
            placeholder=";"
          />
          <button
            className="settings-save-btn"
            onClick={handleSave}
            disabled={saving || prefix === saved || prefix.length < 1}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
        {error && <p className="settings-error">{error}</p>}
        {prefix !== saved && !error && (
          <p className="settings-hint">You have unsaved changes</p>
        )}
      </div>

      <div className="settings-field prefix-settings-roleplay">
        <div className="prefix-settings-roleplay-header">
          <div>
            <label className="settings-label">Roleplay commands</label>
            <p className="settings-desc">
              Disable or enable roleplay commands.
            </p>
          </div>
          <button
            type="button"
            className={`an-toggle ${roleplayEnabled ? 'on' : ''}`}
            onClick={() => void toggleRoleplay()}
            disabled={rpSaving}
            aria-pressed={roleplayEnabled}
            aria-label={roleplayEnabled ? 'Disable roleplay commands' : 'Enable roleplay commands'}
          >
            <span className="an-toggle-knob" />
          </button>
        </div>
        {rpError && <p className="settings-error">{rpError}</p>}
      </div>
    </div>
  )
}
