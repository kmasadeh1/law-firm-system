import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

/**
 * "Back to dashboard" link, routed to /dashboard/owner or /dashboard/staff
 * depending on who's actually signed in - shared by every permission-gated
 * area (Clients, Cases, ...) since each is reachable by both owner and
 * non-owner staff.
 */
export async function BackLink() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const user = data?.claims

  let href = '/dashboard/staff'
  if (user) {
    const { data: staffRow } = await supabase
      .from('staff')
      .select('user_type')
      .eq('id', user.sub)
      .maybeSingle()
    if (staffRow?.user_type === 'owner') {
      href = '/dashboard/owner'
    }
  }

  return (
    <Link
      href={href}
      className="text-sm text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
    >
      ← Dashboard
    </Link>
  )
}
