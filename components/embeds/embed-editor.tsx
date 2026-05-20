'use client'

import { useState } from 'react'
import type { EmbedData, EmbedAuthor, EmbedFooter, EmbedField, EmbedButton } from '@/lib/embeds/types'
import { BUTTON_STYLES } from '@/lib/embeds/constants'
import { extractEmbedTags, type ParsedEmbedPatch } from '@/lib/embeds/parse'

function InputField({ label, value, onChange, placeholder, multiline }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean
}) {
  const shared = {
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value),
    placeholder,
    className: 'embed-input',
    style: {
      width: '100%',
      padding: '0.5rem 0.7rem',
      background: 'rgba(0,0,0,0.35)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: '9px',
      color: '#fff',
      fontSize: '0.85rem',
      outline: 'none',
      resize: 'vertical' as const,
      fontFamily: 'inherit',
      transition: 'border-color 0.2s, box-shadow 0.2s',
    },
  }
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <label style={{ display: 'block', color: 'rgba(255,255,255,0.45)', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>
        {label}
      </label>
      {multiline ? <textarea rows={3} {...shared} /> : <input type="text" {...shared} />}
    </div>
  )
}

function Section({ title, children, defaultOpen }: {
  title: string; children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen ?? false)
  return (
    <div style={{ marginBottom: '0.75rem', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', overflow: 'hidden', background: 'rgba(0,0,0,0.1)' }}>
      <button
        onClick={() => setOpen(!open)}
        className="embed-section-btn"
        style={{
          width: '100%', padding: '0.6rem 0.8rem', background: open ? 'rgba(88,101,242,0.06)' : 'rgba(255,255,255,0.02)',
          border: 'none', color: '#fff', fontSize: '0.85rem', fontWeight: 600,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          transition: 'background 0.2s',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {title}
        </span>
        <span style={{
          color: 'rgba(255,255,255,0.3)', fontSize: '0.65rem',
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.25s',
          display: 'inline-block',
        }}>▼</span>
      </button>
      {open && <div style={{ padding: '0.72rem', borderTop: '1px solid rgba(255,255,255,0.04)' }}>{children}</div>}
    </div>
  )
}

interface EmbedEditorProps {
  data: EmbedData
  update: <K extends keyof EmbedData>(key: K, value: EmbedData[K]) => void
  updateAuthor: (key: keyof EmbedAuthor, value: string) => void
  updateFooter: (key: keyof EmbedFooter, value: string) => void
  addField: () => void
  updateField: (index: number, key: keyof EmbedField, value: string | boolean) => void
  removeField: (index: number) => void
  addButton: () => void
  updateButton: (index: number, key: keyof EmbedButton, value: string | boolean) => void
  removeButton: (index: number) => void
  applyEmbedPatch?: (patch: ParsedEmbedPatch) => void
}

type AutoParseField = 'content' | 'title' | 'description' | 'thumbnail' | 'image' | 'url'

export default function EmbedEditor({
  data, update, updateAuthor, updateFooter,
  addField, updateField, removeField,
  addButton, updateButton, removeButton,
  applyEmbedPatch,
}: EmbedEditorProps) {

  const onTextChange = (fieldKey: AutoParseField) => (newValue: string) => {
    if (!applyEmbedPatch) {
      update(fieldKey, newValue)
      return
    }
    const { cleaned, patch, matched } = extractEmbedTags(newValue)
    if (!matched) {
      update(fieldKey, newValue)
      return
    }
    applyEmbedPatch(patch)
    if (!(fieldKey in patch)) {
      update(fieldKey, cleaned.trim())
    }
  }

  return (
    <>
      <InputField label="Message Content" value={data.content} onChange={onTextChange('content')} placeholder="Text outside the embed" multiline />

      <Section title="Embed Body" defaultOpen>
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div style={{ flex: 1 }}>
            <InputField label="Title" value={data.title} onChange={onTextChange('title')} placeholder="Embed title" />
          </div>
          <div style={{ width: '80px' }}>
            <label style={{ display: 'block', color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
              Color
            </label>
            <input
              type="color"
              value={data.color}
              onChange={e => update('color', e.target.value)}
              style={{ width: '100%', height: '34px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', cursor: 'pointer', padding: 2 }}
            />
          </div>
        </div>
        <InputField label="URL" value={data.url} onChange={onTextChange('url')} placeholder="https://..." />
        <InputField label="Description" value={data.description} onChange={onTextChange('description')} placeholder="Embed description" multiline />
      </Section>

      <Section title="Images">
        <InputField label="Thumbnail URL" value={data.thumbnail} onChange={onTextChange('thumbnail')} placeholder="Small image (top right)" />
        <InputField label="Image URL" value={data.image} onChange={onTextChange('image')} placeholder="Large image (bottom)" />
      </Section>

      <Section title="Author">
        <InputField label="Name" value={data.author.name} onChange={v => updateAuthor('name', v)} placeholder="Author name" />
        <InputField label="Icon URL" value={data.author.icon_url} onChange={v => updateAuthor('icon_url', v)} placeholder="https://..." />
        <InputField label="URL" value={data.author.url} onChange={v => updateAuthor('url', v)} placeholder="https://..." />
      </Section>

      <Section title="Footer">
        <InputField label="Text" value={data.footer.text} onChange={v => updateFooter('text', v)} placeholder="Footer text" />
        <InputField label="Icon URL" value={data.footer.icon_url} onChange={v => updateFooter('icon_url', v)} placeholder="https://..." />
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
          <input type="checkbox" checked={data.timestamp} onChange={e => update('timestamp', e.target.checked)} style={{ accentColor: '#5865f2' }} />
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem' }}>Show timestamp</span>
        </div>
      </Section>

      <Section title={`Fields (${data.fields.length})`}>
        {data.fields.map((field, i) => (
          <div key={i} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '0.65rem', marginBottom: '0.5rem', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', fontWeight: 600 }}>Field {i + 1}</span>
              <button onClick={() => removeField(i)} style={{ background: 'none', border: 'none', color: '#ed4245', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>Remove</button>
            </div>
            <InputField label="Name" value={field.name} onChange={v => updateField(i, 'name', v)} placeholder="Field name" />
            <InputField label="Value" value={field.value} onChange={v => updateField(i, 'value', v)} placeholder="Field value" />
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input type="checkbox" checked={field.inline} onChange={e => updateField(i, 'inline', e.target.checked)} style={{ accentColor: '#5865f2' }} />
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem' }}>Inline</span>
            </div>
          </div>
        ))}
        <button onClick={addField} className="embed-add-btn" style={{
          width: '100%', padding: '0.55rem', background: 'rgba(88,101,242,0.06)', border: '1px dashed rgba(88,101,242,0.25)',
          borderRadius: '9px', color: '#8b9eff', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
          transition: 'all 0.2s',
        }}>
          + Add Field
        </button>
      </Section>

      <Section title={`Buttons (${data.buttons.length})`}>
        {data.buttons.map((btn, i) => (
          <div key={i} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '0.65rem', marginBottom: '0.5rem', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', fontWeight: 600 }}>Button {i + 1}</span>
              <button onClick={() => removeButton(i)} style={{ background: 'none', border: 'none', color: '#ed4245', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>Remove</button>
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ display: 'block', color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>Style</label>
              <select
                value={btn.style}
                onChange={e => updateButton(i, 'style', e.target.value)}
                style={{ width: '100%', padding: '0.5rem 0.75rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: '#fff', fontSize: '0.85rem' }}
              >
                {BUTTON_STYLES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <InputField label="Label" value={btn.label} onChange={v => updateButton(i, 'label', v)} placeholder="Button text" />
            <InputField label="URL" value={btn.url} onChange={v => updateButton(i, 'url', v)} placeholder="https://..." />
            <InputField label="Emoji" value={btn.emoji} onChange={v => updateButton(i, 'emoji', v)} placeholder="Optional emoji" />
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input type="checkbox" checked={btn.disabled} onChange={e => updateButton(i, 'disabled', e.target.checked)} style={{ accentColor: '#5865f2' }} />
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem' }}>Disabled</span>
            </div>
          </div>
        ))}
        <button onClick={addButton} className="embed-add-btn" style={{
          width: '100%', padding: '0.55rem', background: 'rgba(88,101,242,0.06)', border: '1px dashed rgba(88,101,242,0.25)',
          borderRadius: '9px', color: '#8b9eff', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
          transition: 'all 0.2s',
        }}>
          + Add Button
        </button>
      </Section>
    </>
  )
}
