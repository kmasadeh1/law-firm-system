import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Guards everything under /dashboard/owner. The post-login redirect only
 * decides where to send someone once, at sign-in - it doesn't stop an
 * authenticated staff member from navigating here directly afterward. This
 * re-checks user_type on every load of an owner route and sends non-owners
 * to their own dashboard instead.
 */
export default async function OwnerLayout({ children }: LayoutProps<'/dashboard/owner'>) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const user = data?.claims

  if (!user) {
    redirect('/login')
  }

  const { data: staffRow } = await supabase
    .from('staff')
    .select('user_type')
    .eq('id', user.sub)
    .maybeSingle()

  if (staffRow?.user_type !== 'owner') {
    redirect('/dashboard/staff')
  }

  return <>{children}</>
}
