import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Only the auth check redirects. Which clients a signed-in user can actually
 * see is entirely RLS's call now - the clients SELECT policy has three
 * qualifying branches (owner, clients_manage, or being on a case for that
 * client), not one, so there's no single permission left to gate this whole
 * subtree on. The list page renders whatever comes back, including
 * legitimately empty. Writing (create/edit) is still gated, but per-page
 * (clients/new/page.tsx, the [id] detail page) rather than here, since read
 * and write are no longer the same question for this area.
 */
export default async function ClientsLayout({ children }: LayoutProps<'/dashboard/clients'>) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const user = data?.claims

  if (!user) {
    redirect('/login')
  }

  return <>{children}</>
}
