import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Creating a case is a hard binary gate (owner or cases_manage), unlike the
 * case list/detail pages which just render whatever RLS returns. Checked
 * explicitly here, not inferred from anything downstream.
 */
export default async function NewCaseLayout({ children }: LayoutProps<'/dashboard/cases/new'>) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const user = data?.claims

  if (!user) {
    redirect('/login')
  }

  const { data: allowed, error } = await supabase.rpc('has_permission', {
    p_key: 'cases_manage',
  })

  if (error || !allowed) {
    redirect('/dashboard/cases')
  }

  return <>{children}</>
}
