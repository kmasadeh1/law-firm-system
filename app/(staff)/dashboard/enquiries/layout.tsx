import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Guards everything under /dashboard/enquiries on enquiries_manage/owner,
 * same pattern as /dashboard/clients. RLS separately lets someone read an
 * enquiry assigned to them even without enquiries_manage - but the nav
 * entry only appears for enquiries_manage/owner (dashboard/layout.tsx), so
 * gating the whole screen the same way here means the nav and the guard
 * always agree: nobody sees a link that then bounces them.
 */
export default async function EnquiriesLayout({ children }: LayoutProps<'/dashboard/enquiries'>) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const user = data?.claims

  if (!user) {
    redirect('/login')
  }

  const { data: allowed, error } = await supabase.rpc('has_permission', {
    p_key: 'enquiries_manage',
  })

  if (error || !allowed) {
    redirect('/dashboard/staff')
  }

  return <>{children}</>
}
