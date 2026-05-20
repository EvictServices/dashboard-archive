import { redirect } from 'next/navigation'

export default async function ServerSettingsRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/dashboard/${id}/general`)
}
