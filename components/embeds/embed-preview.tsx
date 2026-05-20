'use client'

import type { EmbedData } from '@/lib/embeds/types'
import { BUTTON_STYLE_COLORS } from '@/lib/embeds/constants'
import DiscordMarkdown from '@/components/embeds/discord-markdown'
import { resolveExampleImageUrl, type PreviewContext } from '@/lib/embeds/preview'

export default function EmbedPreview({ data, context }: { data: EmbedData; context?: PreviewContext }) {
  const hasEmbed = data.title || data.description || data.thumbnail || data.image ||
    data.author.name || data.footer.text || data.fields.length > 0

  return (
    <div>
      {data.content && (
        <div style={{ color: '#dcddde', fontSize: '0.9rem', marginBottom: hasEmbed ? '0.5rem' : 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
          <DiscordMarkdown text={data.content} context={context} />
        </div>
      )}

      {hasEmbed && (
        <div style={{
          display: 'flex', maxWidth: '520px', borderRadius: '4px', overflow: 'hidden',
          background: '#2b2d31', borderLeft: `4px solid ${data.color || '#2b2d31'}`,
        }}>
          <div style={{ padding: '0.65rem 0.85rem', flex: 1, minWidth: 0 }}>
            {data.author.name && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                {data.author.icon_url && (
                  <img src={resolveExampleImageUrl(data.author.icon_url, context)} alt="" style={{ width: 24, height: 24, borderRadius: '50%' }} />
                )}
                <span style={{ color: '#fff', fontSize: '0.8rem', fontWeight: 600 }}>
                  <DiscordMarkdown text={data.author.name} context={context} />
                </span>
              </div>
            )}

            {data.title && (
              <div style={{ color: data.url ? '#00aff4' : '#fff', fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.35rem', cursor: data.url ? 'pointer' : 'default' }}>
                <DiscordMarkdown text={data.title} context={context} />
              </div>
            )}

            {data.description && (
              <div style={{ color: '#dcddde', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: '0.5rem', whiteSpace: 'pre-wrap' }}>
                <DiscordMarkdown text={data.description} context={context} />
              </div>
            )}

            {data.fields.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '0.5rem' }}>
                {data.fields.map((field, i) => (
                  <div key={i} style={{ gridColumn: field.inline ? 'span 1' : 'span 3' }}>
                    <div style={{ color: '#fff', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.15rem' }}>
                      <DiscordMarkdown text={field.name} context={context} />
                    </div>
                    <div style={{ color: '#dcddde', fontSize: '0.8rem', lineHeight: 1.4 }}>
                      <DiscordMarkdown text={field.value} context={context} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {data.image && (
              <img src={resolveExampleImageUrl(data.image, context)} alt="" style={{ maxWidth: '100%', borderRadius: '4px', marginBottom: '0.5rem', maxHeight: 300, objectFit: 'contain' }} />
            )}

            {(data.footer.text || data.timestamp) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                {data.footer.icon_url && (
                  <img src={resolveExampleImageUrl(data.footer.icon_url, context)} alt="" style={{ width: 20, height: 20, borderRadius: '50%' }} />
                )}
                <span style={{ color: '#a3a6aa', fontSize: '0.75rem' }}>
                  <DiscordMarkdown text={data.footer.text} context={context} />
                  {data.footer.text && data.timestamp && ' • '}
                  {data.timestamp && new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            )}
          </div>

          {data.thumbnail && (
            <div style={{ padding: '0.65rem 0.85rem 0.65rem 0', flexShrink: 0 }}>
              <img src={resolveExampleImageUrl(data.thumbnail, context)} alt="" style={{ width: 80, height: 80, borderRadius: '4px', objectFit: 'cover' }} />
            </div>
          )}
        </div>
      )}

      {data.buttons.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
          {data.buttons.map((btn, i) => (
            <div
              key={i}
              style={{
                padding: '0.4rem 1rem', borderRadius: '3px',
                background: BUTTON_STYLE_COLORS[btn.style] || '#5865f2',
                color: '#fff', fontSize: '0.85rem', fontWeight: 500,
                opacity: btn.disabled ? 0.5 : 1,
                display: 'flex', alignItems: 'center', gap: '0.35rem',
              }}
            >
              {btn.emoji && (
                <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <DiscordMarkdown text={btn.emoji} context={context} />
                </span>
              )}
              {btn.label}
              {btn.style === 'link' && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: 2, opacity: 0.7 }}>
                  <path d="M10 5V3H5.375C4.06519 3 3 4.06519 3 5.375V18.625C3 19.936 4.06519 21 5.375 21H18.625C19.936 21 21 19.936 21 18.625V14H19V19H5V5H10Z" />
                  <path d="M21 2.99902H14V4.99902H17.586L9.29297 13.292L10.707 14.706L19 6.41302V9.99902H21V2.99902Z" />
                </svg>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
