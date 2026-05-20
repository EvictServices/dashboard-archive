'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type FocusEvent } from 'react'
import { useConfirm } from '@elira/components/shared/confirm-modal'
import EmbedScriptEditorModal from '@/components/settings/EmbedScriptEditorModal'
import {
  defaultEmbed,
  generateScript,
  parseScriptToEmbed,
  type EmbedButton,
  type EmbedData,
  type EmbedField,
} from '@elira/components/embeds/lib/types'
import type { ParsedEmbedPatch } from '@elira/components/embeds/lib/parse'
import type { PreviewContext } from '@elira/components/embeds/lib/preview'
import {
  INVOKE_ACTION_TYPES,
  INVOKE_ACTION_LABELS,
  INVOKE_DEFAULT_MESSAGE,
  type InvokeActionType,
} from '@/lib/settings/invoke-constants'

export interface InvokeSettingsUser {
  id: string
  username: string
  display_name?: string | null
  avatar_url: string
}

function serverPresenceFromTemplates(
  templates: Partial<Record<InvokeActionType, string>>
): Record<InvokeActionType, boolean> {
  return Object.fromEntries(
    INVOKE_ACTION_TYPES.map((k) => [k, Boolean(templates[k])])
  ) as Record<InvokeActionType, boolean>
}

function truncateOneLine(s: string, max: number): string {
  const t = s.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

export default function InvokeSettings({
  guildId,
  guildName,
  guildIconUrl,
  guildBannerUrl,
  user,
}: {
  guildId: string
  guildName: string
  guildIconUrl: string | null
  guildBannerUrl?: string | null
  user: InvokeSettingsUser
}) {
  const { confirm, modal: confirmModal } = useConfirm()
  const previewContext: PreviewContext = useMemo(
    () => ({
      user: {
        id: user.id,
        name: user.username,
        display_name: user.display_name || user.username,
        avatar_url: user.avatar_url,
      },
      moderator: {
        id: user.id,
        name: user.username,
        display_name: user.display_name || user.username,
        avatar_url: user.avatar_url,
      },
      guild: {
        id: guildId,
        name: guildName,
        icon_url: guildIconUrl,
        banner_url: guildBannerUrl ?? null,
      },
    }),
    [guildId, guildName, guildIconUrl, guildBannerUrl, user]
  )

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [templates, setTemplates] = useState<Partial<Record<InvokeActionType, string>>>({})
  const [onServer, setOnServer] = useState<Record<InvokeActionType, boolean>>(
    () =>
      Object.fromEntries(INVOKE_ACTION_TYPES.map((k) => [k, false])) as Record<
        InvokeActionType,
        boolean
      >
  )
  const [savingKey, setSavingKey] = useState<InvokeActionType | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingKey, setEditingKey] = useState<InvokeActionType | null>(null)
  const [embed, setEmbed] = useState<EmbedData>(defaultEmbed)
  const [modalError, setModalError] = useState<string | null>(null)
  const [modalSaving, setModalSaving] = useState(false)

  const lastInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)

  const load = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/guilds/${guildId}/invoke`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Failed to load invoke messages')
        setTemplates({})
        setOnServer(serverPresenceFromTemplates({}))
        return
      }
      const next = (data.templates ?? {}) as Partial<Record<InvokeActionType, string>>
      setTemplates(next)
      setOnServer(serverPresenceFromTemplates(next))
    } catch {
      setError('Failed to load invoke messages')
      setTemplates({})
      setOnServer(serverPresenceFromTemplates({}))
    } finally {
      setLoading(false)
    }
  }, [guildId])

  useEffect(() => {
    void load()
  }, [load])

  const mergeTemplatesResponse = (data: unknown) => {
    const next = (data as { templates?: Partial<Record<InvokeActionType, string>> })?.templates
    if (next && typeof next === 'object') {
      setTemplates(next)
      setOnServer(serverPresenceFromTemplates(next))
    }
  }

  const openEditor = (key: InvokeActionType) => {
    setEditingKey(key)
    setModalError(null)
    setEmbed(parseScriptToEmbed(templates[key] ?? ''))
    setModalOpen(true)
  }

  const closeEditor = () => {
    setModalOpen(false)
    setEditingKey(null)
    setModalError(null)
  }

  const handleEditorFocus = useCallback((e: FocusEvent) => {
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      lastInputRef.current = target as HTMLInputElement | HTMLTextAreaElement
    }
  }, [])

  const insertVariable = useCallback((variable: string) => {
    const el = lastInputRef.current
    if (!el) return
    const start = el.selectionStart ?? el.value.length
    const end = el.selectionEnd ?? el.value.length
    const newValue = el.value.slice(0, start) + variable + el.value.slice(end)
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
    if (setter) {
      setter.call(el, newValue)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }
    el.focus()
    const cursor = start + variable.length
    el.setSelectionRange(cursor, cursor)
  }, [])

  const update = useCallback(<K extends keyof EmbedData>(key: K, value: EmbedData[K]) => {
    setEmbed((prev) => ({ ...prev, [key]: value }))
  }, [])

  const updateAuthor = useCallback((key: keyof EmbedData['author'], value: string) => {
    setEmbed((prev) => ({ ...prev, author: { ...prev.author, [key]: value } }))
  }, [])

  const updateFooter = useCallback((key: keyof EmbedData['footer'], value: string) => {
    setEmbed((prev) => ({ ...prev, footer: { ...prev.footer, [key]: value } }))
  }, [])

  const addField = useCallback(() => {
    setEmbed((prev) => ({ ...prev, fields: [...prev.fields, { name: '', value: '', inline: false }] }))
  }, [])

  const updateField = useCallback((index: number, key: keyof EmbedField, value: string | boolean) => {
    setEmbed((prev) => ({
      ...prev,
      fields: prev.fields.map((f, i) => (i === index ? { ...f, [key]: value } : f)),
    }))
  }, [])

  const removeField = useCallback((index: number) => {
    setEmbed((prev) => ({ ...prev, fields: prev.fields.filter((_, i) => i !== index) }))
  }, [])

  const addButton = useCallback(() => {
    setEmbed((prev) => ({
      ...prev,
      buttons: [...prev.buttons, { style: 'link', label: '', url: '', emoji: '', disabled: false }],
    }))
  }, [])

  const updateButton = useCallback((index: number, key: keyof EmbedButton, value: string | boolean) => {
    setEmbed((prev) => ({
      ...prev,
      buttons: prev.buttons.map((b, i) => (i === index ? { ...b, [key]: value } : b)),
    }))
  }, [])

  const removeButton = useCallback((index: number) => {
    setEmbed((prev) => ({ ...prev, buttons: prev.buttons.filter((_, i) => i !== index) }))
  }, [])

  const applyEmbedPatch = useCallback((patch: ParsedEmbedPatch) => {
    setEmbed((prev) => {
      const next: EmbedData = { ...prev }
      if (patch.content !== undefined) next.content = patch.content
      if (patch.color !== undefined) next.color = patch.color
      if (patch.url !== undefined) next.url = patch.url
      if (patch.title !== undefined) next.title = patch.title
      if (patch.description !== undefined) next.description = patch.description
      if (patch.thumbnail !== undefined) next.thumbnail = patch.thumbnail
      if (patch.image !== undefined) next.image = patch.image
      if (patch.timestamp !== undefined) next.timestamp = patch.timestamp
      if (patch.footer) next.footer = patch.footer
      if (patch.author) next.author = patch.author
      if (patch.addFields?.length) next.fields = [...prev.fields, ...patch.addFields]
      if (patch.addButtons?.length) next.buttons = [...prev.buttons, ...patch.addButtons]
      return next
    })
  }, [])

  const saveModal = async () => {
    if (!editingKey) return
    const script = generateScript(embed).trim()
    if (!script) {
      setModalError('Add message content or embed fields before saving.')
      return
    }
    setModalSaving(true)
    setModalError(null)
    try {
      const res = await fetch(`/api/guilds/${guildId}/invoke`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionType: editingKey, template: script }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setModalError(typeof data.error === 'string' ? data.error : 'Save failed')
        return
      }
      mergeTemplatesResponse(data)
      closeEditor()
    } catch {
      setModalError('Save failed')
    } finally {
      setModalSaving(false)
    }
  }

  const clearAction = async (key: InvokeActionType) => {
    const ok = await confirm({
      title: `Remove ${INVOKE_ACTION_LABELS[key]} invoke message?`,
      description: 'The bot will fall back to the default success message for this action.',
      confirmLabel: 'Remove',
      destructive: true,
    })
    if (!ok) return

    setSavingKey(key)
    setError(null)
    try {
      const res = await fetch(`/api/guilds/${guildId}/invoke?actionType=${encodeURIComponent(key)}`, {
        method: 'DELETE',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Remove failed')
        return
      }
      mergeTemplatesResponse(data)
    } catch {
      setError('Remove failed')
    } finally {
      setSavingKey(null)
    }
  }

  const scriptEmpty = !generateScript(embed).trim()

  if (loading) {
    return <div className="settings-loading">Loading...</div>
  }

  return (
    <div className="invoke-settings-stack">
      {confirmModal}
      <EmbedScriptEditorModal
        open={modalOpen && editingKey != null}
        title={editingKey ? `Edit invoke — ${INVOKE_ACTION_LABELS[editingKey]}` : 'Edit invoke'}
        guildName={guildName}
        guildIconUrl={guildIconUrl}
        previewContext={previewContext}
        embed={embed}
        saving={modalSaving}
        modalError={modalError}
        saveDisabled={scriptEmpty}
        lastInputRef={lastInputRef}
        handleEditorFocus={handleEditorFocus}
        insertVariable={insertVariable}
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
        onClose={closeEditor}
        onSave={() => void saveModal()}
      />

      <p className="invoke-settings-intro">
        Custom messages sent after moderation actions, same as{' '}
        <code className="prefix-settings-inline-code">;invoke</code> in Discord. Variables such as{' '}
        <code className="prefix-settings-inline-code">{'{user.mention}'}</code>,{' '}
        <code className="prefix-settings-inline-code">{'{moderator.mention}'}</code>, and{' '}
        <code className="prefix-settings-inline-code">{'{reason}'}</code> work when the bot sends the message.
      </p>
      {error && <p className="settings-error">{error}</p>}

      {INVOKE_ACTION_TYPES.map((key) => {
        const tpl = templates[key]
        return (
          <div key={key} className="invoke-action-card">
            <div className="invoke-action-card-header">
              <div className="settings-label" style={{ margin: 0 }}>
                {INVOKE_ACTION_LABELS[key]}
              </div>
              <span className="invoke-action-key">
                <code>{key}</code>
              </span>
            </div>
            <p className="invoke-action-card-summary">
              {tpl ? truncateOneLine(tpl, 140) : INVOKE_DEFAULT_MESSAGE[key]}
            </p>
            <div className="invoke-action-card-actions">
              <button
                type="button"
                className="settings-save-btn"
                onClick={() => openEditor(key)}
                disabled={savingKey !== null || modalSaving}
              >
                Edit
              </button>
              <button
                type="button"
                className="settings-save-btn welcome-message-remove-btn"
                onClick={() => void clearAction(key)}
                disabled={savingKey !== null || modalSaving || !onServer[key]}
              >
                {savingKey === key ? '…' : 'Clear'}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
