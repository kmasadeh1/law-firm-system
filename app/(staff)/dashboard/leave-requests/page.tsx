import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/dashboard/page-header'
import { getStaffLocale } from '@/lib/get-staff-locale'
import { RequestLeaveForm } from './request-leave-form'
import { BlockDaysOffForm } from './block-days-off-form'
import { MyRequestsList, type MyLeaveRequest } from './my-requests-list'
import { TeamRequestsSection, type TeamLeaveRequest } from './team-requests-section'
import type { Database } from '@/lib/supabase/database.types'

// can_withdraw is a real PostgREST computed column (it takes the table's
// row type, not a uuid), so the query below genuinely returns it - but the
// generated Database type only records it under Functions, not merged into
// leave_requests' Row type, so the query builder doesn't know about it
// statically. .returns<>() below tells TypeScript what PostgREST actually
// sends back; it doesn't change the request.
type LeaveRequestRow = {
  id: string
  staff_id: string | null
  start_date: string
  end_date: string
  status: Database['public']['Enums']['leave_status']
  approved_by: string | null
  created_at: string
  can_withdraw: boolean
}

export default async function LeaveRequestsPage() {
  const supabase = await createClient()
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.leaveRequests' })
  const tCommon = await getTranslations({ locale, namespace: 'dashboard.common' })

  const [{ data }, { data: isOwner }, { data: requestRows }, { data: pendingRows }, { data: staffDirectory }] =
    await Promise.all([
      supabase.auth.getClaims(),
      supabase.rpc('is_owner'),
      // Everyone's rows if the caller is the owner, otherwise RLS narrows
      // this to just their own - used below for "my requests" (an
      // identity filter, which is what that list IS) and "answered" (a
      // status filter). can_withdraw is a computed column (takes the
      // table's own row type, not a uuid), so PostgREST resolves it in
      // this same request - one round trip for the whole list, not one
      // rpc() call per row. It's the exact same rule the DELETE policy
      // enforces, so a true here means the delete will actually succeed.
      supabase
        .from('leave_requests')
        .select('id, staff_id, start_date, end_date, status, approved_by, created_at, can_withdraw')
        .order('start_date', { ascending: false })
        .returns<LeaveRequestRow[]>(),
      // The approvals queue's own query, filtered on status = 'pending' -
      // not by excluding the current user in the component. The owner's
      // own leave is always inserted already-approved, so it can never be
      // pending and drops out of this list on its own.
      supabase
        .from('leave_requests')
        .select('id, staff_id, start_date, end_date, status, approved_by, created_at, can_withdraw')
        .eq('status', 'pending')
        .order('start_date', { ascending: false })
        .returns<LeaveRequestRow[]>(),
      // Unfiltered - a requester or approver should still show their name
      // after leaving the firm, same reasoning as case/enquiry notes.
      supabase.from('staff_directory').select('id, full_name'),
    ])

  const staffId = data?.claims?.sub as string | undefined
  const nameById = new Map(
    (staffDirectory ?? [])
      .filter((s): s is { id: string; full_name: string } => s.id !== null && s.full_name !== null)
      .map((s) => [s.id, s.full_name])
  )

  const rows = requestRows ?? []
  const myRequests: MyLeaveRequest[] = rows
    .filter((r) => r.staff_id === staffId)
    .map((r) => ({
      id: r.id,
      start_date: r.start_date,
      end_date: r.end_date,
      status: r.status,
      approved_by_name: r.approved_by ? (nameById.get(r.approved_by) ?? tCommon('unknownStaff')) : null,
      can_withdraw: r.can_withdraw ?? false,
    }))

  const toTeamRequest = (r: (typeof rows)[number]): TeamLeaveRequest => ({
    id: r.id,
    start_date: r.start_date,
    end_date: r.end_date,
    status: r.status,
    approved_by_name: r.approved_by ? (nameById.get(r.approved_by) ?? tCommon('unknownStaff')) : null,
    requester_name: r.staff_id ? (nameById.get(r.staff_id) ?? tCommon('unknownStaff')) : tCommon('unknownStaff'),
  })
  // Pending comes straight from its own query above - no staff_id
  // exclusion here. Answered is everyone's decided leave, including the
  // owner's own blocked days alongside everyone else's.
  const pendingRequests = (pendingRows ?? []).map(toTeamRequest)
  const answeredRequests = rows.filter((r) => r.status !== 'pending').map(toTeamRequest)

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t('title')} description={t('description')} />

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg text-fg">
          {isOwner === true ? t('blockDaysOffHeading') : t('requestHeading')}
        </h2>
        {isOwner === true ? <BlockDaysOffForm /> : <RequestLeaveForm />}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg text-fg">{t('myRequestsHeading')}</h2>
        <MyRequestsList requests={myRequests} />
      </section>

      {isOwner === true && (
        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-lg text-fg">{t('teamHeading')}</h2>
          <TeamRequestsSection pendingRequests={pendingRequests} answeredRequests={answeredRequests} />
        </section>
      )}
    </div>
  )
}
