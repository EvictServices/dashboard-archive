import type { EmbedAuthor, EmbedButton, EmbedField, EmbedFooter } from './types'

const KNOWN_TAGS = new Set([
  'content',
  'embed',
  'color',
  'url',
  'title',
  'description',
  'thumbnail',
  'image',
  'field',
  'footer',
  'author',
  'button',
  'timestamp',
])

const KNOWN_BUTTON_STYLES = new Set([
  'link',
  'url',
  'blurple',
  'blue',
  'primary',
  'green',
  'success',
  'grey',
  'gray',
  'secondary',
  'red',
  'danger',
])

export interface ParsedEmbedPatch {
  content?: string
  color?: string
  url?: string
  title?: string
  description?: string
  thumbnail?: string
  image?: string
  timestamp?: boolean
  footer?: EmbedFooter
  author?: EmbedAuthor
  addFields?: EmbedField[]
  addButtons?: EmbedButton[]
}

interface ExtractResult {
  cleaned: string
  patch: ParsedEmbedPatch
  matched: boolean
}

/**
 * Walk the input character-by-character, finding balanced top-level `{…}` blocks.
 * If the block's leading identifier is a known embed tag (e.g. `thumbnail`, `description`),
 * extract its value into a patch and strip the block from the output. Unknown tags such as
 * variable placeholders like `{user.mention}` or `{guild.icon}` are left untouched, including
 * when they appear nested inside a recognized tag's value (e.g. `{thumbnail: {user.avatar}}`).
 */
export function extractEmbedTags(input: string): ExtractResult {
  const patch: ParsedEmbedPatch = {}
  let matched = false
  let output = ''
  let i = 0

  while (i < input.length) {
    if (input[i] !== '{') {
      output += input[i]
      i++
      continue
    }

    let depth = 1
    let j = i + 1
    while (j < input.length && depth > 0) {
      const ch = input[j]
      if (ch === '{') depth++
      else if (ch === '}') {
        depth--
        if (depth === 0) break
      }
      j++
    }

    if (depth !== 0) {
      output += input[i]
      i++
      continue
    }

    const inner = input.slice(i + 1, j)
    const colonIdx = inner.indexOf(':')
    const tagRaw = colonIdx === -1 ? inner : inner.slice(0, colonIdx)
    const tag = tagRaw.trim().toLowerCase()

    if (!KNOWN_TAGS.has(tag)) {
      output += input.slice(i, j + 1)
      i = j + 1
      continue
    }

    const rest = colonIdx === -1 ? '' : inner.slice(colonIdx + 1).trim()
    applyTag(patch, tag, rest)
    matched = true
    i = j + 1
    if (input[i] === '\n') i++
  }

  return { cleaned: output, patch, matched }
}

function applyTag(patch: ParsedEmbedPatch, tag: string, rest: string): void {
  switch (tag) {
    case 'embed':
      return
    case 'timestamp':
      patch.timestamp = true
      return
    case 'content':
      patch.content = rest
      return
    case 'color': {
      let c = rest.trim()
      if (/^[0-9a-f]{6}$/i.test(c)) c = '#' + c.toLowerCase()
      else if (/^#[0-9a-f]{6}$/i.test(c)) c = c.toLowerCase()
      patch.color = c
      return
    }
    case 'url':
      patch.url = rest
      return
    case 'title':
      patch.title = rest
      return
    case 'description':
      patch.description = rest
      return
    case 'thumbnail':
      patch.thumbnail = rest
      return
    case 'image':
      patch.image = rest
      return
    case 'field': {
      const parts = rest.split(' && ').map((p) => p.trim())
      if (parts.length < 2) return
      const inline = parts[parts.length - 1] === 'inline'
      const name = parts[0]
      const value = inline ? parts.slice(1, -1).join(' && ') : parts.slice(1).join(' && ')
      if (!name || !value) return
      patch.addFields = [...(patch.addFields ?? []), { name, value, inline }]
      return
    }
    case 'footer': {
      const parts = rest.split(' && ').map((p) => p.trim())
      patch.footer = { text: parts[0] ?? '', icon_url: parts[1] ?? '' }
      return
    }
    case 'author': {
      const parts = rest.split(' && ').map((p) => p.trim())
      patch.author = {
        name: parts[0] ?? '',
        url: parts[1] && parts[1] !== 'null' ? parts[1] : '',
        icon_url: parts[2] ?? '',
      }
      return
    }
    case 'button': {
      const parts = rest.split(' && ').map((p) => p.trim())
      if (parts.length < 2) return

      let style = 'link'
      let label: string
      let url: string
      let extras: string[]

      const first = parts[0]?.toLowerCase() ?? ''
      const looksLikeStyle = KNOWN_BUTTON_STYLES.has(first) && parts.length >= 3
      if (looksLikeStyle) {
        style = first
        label = parts[1] ?? ''
        url = parts[2] ?? ''
        extras = parts.slice(3)
      } else {
        label = parts[0] ?? ''
        url = parts[1] ?? ''
        extras = parts.slice(2)
      }

      if (!label || !url) return

      const disabled = extras.includes('disabled')
      let emoji = ''
      for (const p of extras) {
        if (p !== 'disabled' && !emoji) emoji = p
      }

      patch.addButtons = [...(patch.addButtons ?? []), { style, label, url, emoji, disabled }]
      return
    }
  }
}
