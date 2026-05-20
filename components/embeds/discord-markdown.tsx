'use client'

import { Fragment } from 'react'
import { resolveVariable, type PreviewContext } from '@/lib/embeds/preview'

const mentionStyle = {
  background: 'rgba(88,101,242,0.3)',
  color: '#dee0fc',
  padding: '0 2px',
  borderRadius: '3px',
  fontWeight: 500,
  cursor: 'pointer',
}

const channelStyle = {
  ...mentionStyle,
}

const codeBlockStyle = {
  background: '#2b2d31',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: '4px',
  padding: '0.5rem',
  fontFamily: 'monospace',
  fontSize: '0.8rem',
  color: '#dcddde',
  display: 'block' as const,
  whiteSpace: 'pre-wrap' as const,
  margin: '0.25rem 0',
}

const inlineCodeStyle = {
  background: '#2b2d31',
  padding: '0.1rem 0.35rem',
  borderRadius: '3px',
  fontFamily: 'monospace',
  fontSize: '0.8rem',
  color: '#dcddde',
}

const emojiStyle = {
  width: '1.375em',
  height: '1.375em',
  verticalAlign: '-0.3em',
  objectFit: 'contain' as const,
  display: 'inline-block',
}

type TextNode =
  | string
  | { type: string; content: React.ReactNode; href?: string; animated?: boolean }

function parseMarkdown(text: string): TextNode[] {
  const nodes: TextNode[] = []
  let remaining = text

  const patterns: [RegExp, (m: RegExpMatchArray) => TextNode][] = [
    [/^```(?:\w*\n)?([\s\S]*?)```/, m => ({ type: 'codeblock', content: m[1] })],
    [/^`([^`]+)`/, m => ({ type: 'code', content: m[1] })],
    [/^\*\*\*(.+?)\*\*\*/, m => ({ type: 'bolditalic', content: m[1] })],
    [/^\*\*(.+?)\*\*/, m => ({ type: 'bold', content: m[1] })],
    [/^\*(.+?)\*/, m => ({ type: 'italic', content: m[1] })],
    [/^__(.+?)__/, m => ({ type: 'underline', content: m[1] })],
    [/^_(.+?)_/, m => ({ type: 'italic', content: m[1] })],
    [/^~~(.+?)~~/, m => ({ type: 'strike', content: m[1] })],
    [/^\|\|(.+?)\|\|/, m => ({ type: 'spoiler', content: m[1] })],
    [/^> (.+?)(?:\n|$)/, m => ({ type: 'quote', content: m[1] })],
    [/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)/, m => ({ type: 'link', content: m[1], href: m[2] })],
    [/^<(a?):([\w~]+):(\d+)>/, m => ({ type: 'emoji', content: m[2], href: m[3], animated: m[1] === 'a' })],
    [/^<#\d+>/, () => ({ type: 'channel', content: '#channel' })],
    [/^<@&\d+>/, () => ({ type: 'role', content: '@role' })],
    [/^<@!?\d+>/, () => ({ type: 'mention', content: '@user' })],
    [/^\{[a-z_]+(?:\.[a-z_]+)*\}/, m => ({ type: 'var', content: m[0].slice(1, -1) })],
  ]

  while (remaining.length > 0) {
    let matched = false
    for (const [pattern, handler] of patterns) {
      const match = remaining.match(pattern)
      if (match) {
        if (nodes.length > 0 || match.index! > 0) {
          const before = remaining.slice(0, match.index!)
          if (before) nodes.push(before)
        }
        nodes.push(handler(match))
        remaining = remaining.slice(match[0].length)
        matched = true
        break
      }
    }
    if (!matched) {
      const nextSpecial = remaining.slice(1).search(/[`*_~|>\[{<]/)
      if (nextSpecial === -1) {
        nodes.push(remaining)
        break
      }
      nodes.push(remaining.slice(0, nextSpecial + 1))
      remaining = remaining.slice(nextSpecial + 1)
    }
  }

  return nodes
}

function RenderNode({ node, index, context }: { node: TextNode; index: number; context?: PreviewContext }) {
  if (typeof node === 'string') return <Fragment key={index}>{node}</Fragment>

  switch (node.type) {
    case 'bold':
      return <strong key={index} style={{ color: '#fff', fontWeight: 700 }}>{renderInline(node.content as string, context)}</strong>
    case 'italic':
      return <em key={index}>{renderInline(node.content as string, context)}</em>
    case 'bolditalic':
      return <strong key={index} style={{ color: '#fff', fontWeight: 700 }}><em>{renderInline(node.content as string, context)}</em></strong>
    case 'underline':
      return <u key={index}>{renderInline(node.content as string, context)}</u>
    case 'strike':
      return <s key={index} style={{ textDecoration: 'line-through' }}>{renderInline(node.content as string, context)}</s>
    case 'code':
      return <code key={index} style={inlineCodeStyle}>{node.content}</code>
    case 'codeblock':
      return <code key={index} style={codeBlockStyle}>{node.content}</code>
    case 'spoiler':
      return <span key={index} style={{ background: '#202225', color: '#202225', borderRadius: '3px', padding: '0 2px', cursor: 'pointer' }}>{node.content}</span>
    case 'quote':
      return (
        <div key={index} style={{ borderLeft: '3px solid #4e5058', paddingLeft: '0.5rem', margin: '0.15rem 0' }}>
          {renderInline(node.content as string, context)}
        </div>
      )
    case 'link':
      return <span key={index} style={{ color: '#00aff4', textDecoration: 'none' }}>{node.content}</span>
    case 'mention':
      return <span key={index} style={mentionStyle}>{node.content}</span>
    case 'channel':
      return <span key={index} style={channelStyle}>{node.content}</span>
    case 'role':
      return <span key={index} style={mentionStyle}>{node.content}</span>
    case 'emoji': {
      const ext = node.animated ? 'gif' : 'png'
      const id = node.href
      const name = String(node.content)
      return (
        <img
          key={index}
          src={`https://cdn.discordapp.com/emojis/${id}.${ext}?size=32&quality=lossless`}
          alt={`:${name}:`}
          title={`:${name}:`}
          style={emojiStyle}
          draggable={false}
        />
      )
    }
    case 'var': {
      const path = node.content as string
      const resolved = resolveVariable(path, context)
      if (resolved.kind === 'mention') return <span key={index} style={mentionStyle}>{resolved.value}</span>
      if (resolved.kind === 'channel') return <span key={index} style={channelStyle}>{resolved.value}</span>
      if (resolved.kind === 'role') return <span key={index} style={mentionStyle}>{resolved.value}</span>
      if (resolved.kind === 'unknown') {
        return <span key={index} style={{ color: 'rgba(255,255,255,0.4)', fontStyle: 'italic', fontSize: '0.85em' }}>{resolved.value}</span>
      }
      return <span key={index}>{resolved.value}</span>
    }
    default:
      return <Fragment key={index}>{node.content}</Fragment>
  }
}

function renderInline(text: string, context?: PreviewContext): React.ReactNode {
  const nodes = parseMarkdown(text)
  return nodes.map((n, i) => <RenderNode key={i} node={n} index={i} context={context} />)
}

export default function DiscordMarkdown({ text, context }: { text: string; context?: PreviewContext }) {
  if (!text) return null
  const nodes = parseMarkdown(text)
  return (
    <span>
      {nodes.map((n, i) => (
        <RenderNode key={i} node={n} index={i} context={context} />
      ))}
    </span>
  )
}
