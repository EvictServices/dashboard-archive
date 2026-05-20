export interface Command {
  name: string
  description: string
  category: string
  aliases: string[]
  signature: string
  permissions: unknown
  example: string
}
