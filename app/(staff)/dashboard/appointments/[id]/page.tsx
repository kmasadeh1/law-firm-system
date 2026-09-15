import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BackLink } from '../../back-link'
import { AppointmentForm } from '../appointment-form'

export default async function AppointmentDetailPage({
  params,
}: PageProps<'/dashboard/appointments/[id]'>) {
  const { id } = await params
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  const user = claims?.claims

  if (!user) {
    redirect('/login')
  }

  // No access gate here either - a row RLS hides looks identical to one
  // that doesn't exist, same as Cases/Clients detail pages.
  const { data: appt } = await supabase
    .from('appointments')
    .select(
      'id, type, status, starts_at, ends_at, notes, staff_id, clients(id, full_name, national_id), cases(id, case_number, title)'
    )
    .eq('id', id)
    .maybeSingle()

  if (!appt) {
    return (
      <div className="min-h-screen bg-zinc-50 px-4 py-10 dark:bg-black sm:px-8">
        <div className="mx-auto flex max-w-2xl flex-col gap-6">
          <BackLink />
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            This appointment doesn&apos;t exist, or you don&apos;t have access to it.
          </p>
        </div>
      </div>
    )
  }

  const [{ data: canAssignAll }, { data: canAssignCourtDates }, { data: staff }, { data: me }] =
    await Promise.all([
      supabase.rpc('has_permission', { p_key: 'appointments_view_all' }),
      supabase.rpc('has_permission', { p_key: 'court_dates_manage' }),
      supabase.from('staff_directory').select('id, full_name').eq('is_active', true).order('full_name'),
      supabase.from('staff_directory').select('full_name').eq('id', user.sub as string).maybeSingle(),
    ])

  const staffOptions = (staff ?? []).filter(
    (s): s is { id: string; full_name: string } => s.id !== null && s.full_name !== null
  )

  if (!appt.clients) {
    return (
      <div className="min-h-screen bg-zinc-50 px-4 py-10 dark:bg-black sm:px-8">
        <div className="mx-auto flex max-w-2xl flex-col gap-6">
          <BackLink />
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            This appointment&apos;s client record is missing.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-10 dark:bg-black sm:px-8">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div>
          <BackLink />
          <h1 className="mt-1 text-2xl font-semibold text-black dark:text-zinc-50">
            {appt.type === 'court_date' ? 'Court date' : 'Consultation'}
          </h1>
        </div>

        <AppointmentForm
          mode="edit"
          appointmentId={appt.id}
          initial={{
            type: appt.type,
            client: {
              id: appt.clients.id,
              full_name: appt.clients.full_name,
              national_id: appt.clients.national_id,
            },
            case: appt.cases
              ? { id: appt.cases.id, case_number: appt.cases.case_number, title: appt.cases.title }
              : null,
            staff_id: appt.staff_id,
            starts_at: appt.starts_at,
            ends_at: appt.ends_at,
            notes: appt.notes,
            status: appt.status,
          }}
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
