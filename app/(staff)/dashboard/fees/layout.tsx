import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Guards everything under /dashboard/fees - viewing and managing
 * engagements, linked cases, and instalments all require fees_view (owner
 * or explicit permission). Recording a payment is gated separately, per
 * action, on payments_record - see recordPayment in actions.ts and the
 * canRecordPayments prop threaded into InstallmentsSection.
 */
export default async function FeesLayout({ children }: LayoutProps<'/dashboard/fees'>) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const user = data?.claims

  if (!user) {
    redirect('/login')
  }

  const { data: allowed, error } = await supabase.rpc('has_permission', {
    p_key: 'fees_view',
  })

  if (error || !allowed) {
    redirect('/dashboard/staff')
  }

  return <>{children}</>
}
