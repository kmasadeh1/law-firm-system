import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BackLink } from '../../back-link'
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
    <div className="min-h-screen bg-zinc-50 px-4 py-10 dark:bg-black sm:px-8">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div>
          <BackLink />
          <h1 className="mt-1 text-2xl font-semibold text-black dark:text-zinc-50">
            New appointment
          </h1>
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
    </div>
  )
}
