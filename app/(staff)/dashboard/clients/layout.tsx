import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Guards everything under /dashboard/clients. This is the first area gated
 * by a specific permission rather than owner-vs-staff, so the check is
 * explicit and server-side: the has_permission RPC (which already returns
 * true for the owner internally). A denial redirects - it is never inferred
 * from a later query coming back empty, since an empty result and "no
 * access" are otherwise indistinguishable.
 */
export default async function ClientsLayout({ children }: LayoutProps<'/dashboard/clients'>) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const user = data?.claims

  if (!user) {
    redirect('/login')
  }

  const { data: allowed, error } = await supabase.rpc('has_permission', {
    p_key: 'clients_manage',
  })

  if (error || !allowed) {
    redirect('/dashboard/staff')
  }

  return <>{children}</>
}
