import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Guards everything under /dashboard/reports on reports_view/owner, same
 * pattern as /dashboard/clients and /dashboard/enquiries. Kept outside
 * /dashboard/owner (whose layout is unconditionally owner-only) so a future
 * role holding reports_view isn't blocked by a guard that was never meant
 * for it - right now no seeded role holds it, so only the owner sees this,
 * but that's config, not the route's access rule.
 */
export default async function ReportsLayout({ children }: LayoutProps<'/dashboard/reports'>) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const user = data?.claims

  if (!user) {
    redirect('/login')
  }

  const { data: allowed, error } = await supabase.rpc('has_permission', {
    p_key: 'reports_view',
  })

  if (error || !allowed) {
    redirect('/dashboard/staff')
  }

  return <>{children}</>
}
