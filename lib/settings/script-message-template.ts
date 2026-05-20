import {
  defaultEmbed,
  generateScript,
  type EmbedButton,
  type EmbedData,
  type EmbedField,
} from '@elira/components/embeds/lib/types'

export const CHANNEL_SNOWFLAKE = /^\d{15,22}$/

function normalizeEmbedInput(v: unknown): EmbedData | null {
  if (!v || typeof v !== 'object') return null
  const p = v as Record<string, unknown>
  const base = defaultEmbed()
  const author =
    p.author && typeof p.author === 'object' && !Array.isArray(p.author)
      ? { ...base.author, ...(p.author as Record<string, string>) }
      : base.author
  const footer =
    p.footer && typeof p.footer === 'object' && !Array.isArray(p.footer)
      ? { ...base.footer, ...(p.footer as Record<string, string>) }
      : base.footer
  return {
    ...base,
    content: typeof p.content === 'string' ? p.content : base.content,
    color: typeof p.color === 'string' ? p.color : base.color,
    title: typeof p.title === 'string' ? p.title : base.title,
    url: typeof p.url === 'string' ? p.url : base.url,
    description: typeof p.description === 'string' ? p.description : base.description,
    thumbnail: typeof p.thumbnail === 'string' ? p.thumbnail : base.thumbnail,
    image: typeof p.image === 'string' ? p.image : base.image,
    timestamp: typeof p.timestamp === 'boolean' ? p.timestamp : base.timestamp,
    author,
    footer,
    fields: Array.isArray(p.fields) ? (p.fields as EmbedField[]) : base.fields,
    buttons: Array.isArray(p.buttons) ? (p.buttons as EmbedButton[]) : base.buttons,
  }
}

/**
 * Resolve script template from dashboard PATCH body (`template` or `embed`), same as welcome/boost/goodbye bot tables.
 */
export function resolveScriptTemplateFromBody(body: Record<string, unknown>): { template: string } | { error: string } {
  if (typeof body.template === 'string' && body.template.trim()) {
    return { template: body.template.trim() }
  }
  const embed = normalizeEmbedInput(body.embed)
  if (!embed) {
    return { error: 'Provide embed or template' }
  }
  const template = generateScript(embed)
  if (!template.trim()) {
    return { error: 'Message cannot be empty' }
  }
  return { template }
}
