import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Guards everything under /dashboard/enquiries on enquiries_manage/owner
 * (has_permission() returns true for the owner already, so that single
 * check covers both) OR having at least one enquiry assigned - RLS already
 * lets someone read an enquiry assigned to them even without
 * enquiries_manage, so the guard has to ask the same question RLS does
 * before bouncing them, same as the nav entry in dashboard/layout.tsx.
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

  if (error) {
    redirect('/dashboard/staff')
  }

  if (!allowed) {
    const { count } = await supabase
      .from('enquiries')
      .select('id', { count: 'exact', head: true })
      .eq('assigned_to', user.sub as string)

    if (!count) {
      redirect('/dashboard/staff')
    }
  }

  return <>{children}</>
}
