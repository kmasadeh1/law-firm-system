import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getStaffLocale } from '@/lib/get-staff-locale'
import { OwnerNoAccess } from '@/components/dashboard/owner-no-access'

/**
 * Guards the firm's reference lists - courts, case types, referral sources.
 * Their write policies are can_manage_reference_data() (owner, or a role
 * holding reference_data_manage), so they live outside /dashboard/owner,
 * whose layout refuses every non-owner. This asks the same function the
 * policies do, once per load.
 *
 * Deadline period types are NOT here: their policies are still is_owner(),
 * so that screen stays under /dashboard/owner.
 *
 * Refused renders in place with the shell still around it, same as the
 * owner layout - an intact session redirected elsewhere reads as a broken
 * link.
 */
export default async function ReferenceLayout({ children }: LayoutProps<'/dashboard/reference'>) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()

  if (!data?.claims) {
    redirect('/login')
  }

  const { data: allowed, error } = await supabase.rpc('can_manage_reference_data')

  if (error || allowed !== true) {
    const locale = await getStaffLocale()
    return <OwnerNoAccess locale={locale} variant="permission" />
  }

  return <>{children}</>
}
