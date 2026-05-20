import { NextRequest } from 'next/server'
import { handleScriptMessagePatch, handleScriptMessageDelete } from '@/lib/settings/script-message-route'

export function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ guildId: string }> }
) {
  return handleScriptMessagePatch('goodbye', req, ctx)
}

export function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ guildId: string }> }
) {
  return handleScriptMessageDelete('goodbye', req, ctx)
}
