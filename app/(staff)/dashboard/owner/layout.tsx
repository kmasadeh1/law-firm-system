import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getStaffLocale } from '@/lib/get-staff-locale'
import { OwnerNoAccess } from '@/components/dashboard/owner-no-access'

/**
 * Guards everything under /dashboard/owner. The post-login redirect only
 * decides where to send someone once, at sign-in - it doesn't stop an
 * authenticated staff member from navigating here directly afterward. This
 * re-checks user_type on every load of an owner route.
 *
 * Not signed in and signed in-but-not-owner are different failures and get
 * different treatment: the former has no session to show anything in, so
 * /login is correct. The latter has an intact session - redirecting it
 * anywhere (including to another dashboard page) reads as a broken link or
 * a dead session, so it renders in place instead, with the shell and nav
 * (mounted by the parent layout) still around it.
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
    const locale = await getStaffLocale()
    return <OwnerNoAccess locale={locale} />
  }

  return <>{children}</>
}
