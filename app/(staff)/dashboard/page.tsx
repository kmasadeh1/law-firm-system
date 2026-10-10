import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// The bare /dashboard has no page of its own: it sends the signed-in user to
// their home. (The dashboard layout has already redirected anyone who is not
// signed in to /login.)
export default async function DashboardIndexPage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const user = data?.claims
  if (!user) redirect('/login')

  const { data: staffRow } = await supabase
    .from('staff')
    .select('user_type')
    .eq('id', user.sub as string)
    .maybeSingle()

  redirect(staffRow?.user_type === 'owner' ? '/dashboard/owner' : '/dashboard/staff')
}
