import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BackLink } from '@/components/dashboard/back-link'
import { PageHeader } from '@/components/dashboard/page-header'
import { AppointmentForm } from '../appointment-form'

/**
 * No route gate here - everyone can create at least their own appointment
 * (staff_id = self is always allowed by RLS). Whether they can assign
 * someone else is decided per-field inside the form, not by blocking the
 * whole page.
 */
export default async function NewAppointmentPage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const user = data?.claims

  if (!user) {
    redirect('/login')
  }

  const [{ data: canAssignAll }, { data: canAssignCourtDates }, { data: staff }, { data: me }] =
    await Promise.all([
      supabase.rpc('has_permission', { p_key: 'appointments_view_all' }),
      supabase.rpc('has_permission', { p_key: 'court_dates_manage' }),
      supabase.from('staff_directory').select('id, full_name').eq('is_active', true).order('full_name'),
      supabase.from('staff_directory').select('full_name').eq('id', user.sub).maybeSingle(),
    ])

  const staffOptions = (staff ?? []).filter(
    (s): s is { id: string; full_name: string } => s.id !== null && s.full_name !== null
  )

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <BackLink href="/dashboard/appointments" label="Appointments" />
        <PageHeader title="New appointment" />
      </div>

      <AppointmentForm
        mode="create"
        currentStaffId={user.sub as string}
        currentStaffName={me?.full_name ?? 'You'}
        staffOptions={staffOptions}
        canAssignAll={Boolean(canAssignAll)}
        canAssignCourtDates={Boolean(canAssignCourtDates)}
      />
    </div>
  )
}
