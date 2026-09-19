import { createClient } from '@/lib/supabase/server'
import { BackLink } from '@/components/dashboard/back-link'
import { PageHeader } from '@/components/dashboard/page-header'
import { StatusSection } from './status-section'
import { TeamSection } from './team-section'
import { OpposingPartiesSection } from './opposing-parties-section'
import { DeadlinesSection } from './deadlines-section'
import { ShareLinksSection } from './share-links-section'
import { DocumentsSection, type DocumentRow } from './documents-section'
import { NotesSection, type CaseNote } from './notes-section'
import { ExpensesSection, type Expense } from './expenses-section'
import { TimelineSection, type TimelineRow } from './timeline-section'

export default async function CaseDetailPage({ params }: PageProps<'/dashboard/cases/[id]'>) {
  const { id } = await params
  const supabase = await createClient()

  // No access gate here either - a row RLS hides looks identical to one
  // that doesn't exist, same as the Clients edit page.
  const { data: caseRow } = await supabase
    .from('cases')
    .select(
      'id, case_number, title, case_type, status_id, opened_at, closed_at, clients(id, full_name)'
    )
    .eq('id', id)
    .maybeSingle()

  if (!caseRow) {
    return (
      <div className="flex flex-col gap-6">
        <BackLink href="/dashboard/cases" label="Cases" />
        <p className="text-sm text-fg-muted">
          This case doesn&apos;t exist, or you don&apos;t have access to it.
        </p>
      </div>
    )
  }

  const [
    { data: statuses },
    { data: teamRows },
    { data: staffDirectory },
    { data: opposingParties },
    { data: deadlineRows },
    { data: periodTypes },
    { data: shareLinks },
    { data: documentRows },
    { data: noteRows },
    { data: allStaffDirectory },
    { data: canManageExpenses },
    { data: expenseRows },
    { data: timelineRows, error: timelineError },
  ] = await Promise.all([
    supabase.from('case_statuses').select('id, name, is_terminal').order('sort_order'),
    supabase.from('case_lawyers').select('staff_id, is_lead').eq('case_id', id),
    supabase.from('staff_directory').select('id, full_name').eq('is_active', true).order('full_name'),
    supabase.from('case_opposing_parties').select('id, name, national_id').eq('case_id', id),
    supabase
      .from('deadlines')
      .select(
        'id, trigger_date, due_date, unadjusted_due_date, effective_due_date, extended_due_date, extension_reason, extended_by, extended_at, description, deadline_period_types(name, period_days)'
      )
      .eq('case_id', id)
      .order('effective_due_date', { ascending: true, nullsFirst: false }),
    supabase.from('deadline_period_types').select('id, name, period_days, description').order('name'),
    supabase
      .from('case_share_links')
      .select('id, label, created_at, expires_at, revoked_at, last_accessed_at, access_count')
      .eq('case_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('documents')
      .select('id, filename, uploaded_at, uploaded_by, deleted_at, deleted_by')
      .eq('case_id', id)
      .order('uploaded_at', { ascending: false }),
    supabase
      .from('case_notes')
      .select('id, note, created_at, staff_id, edited_at, deleted_at, deleted_by')
      .eq('case_id', id)
      .order('created_at', { ascending: false }),
    // Unfiltered, unlike activeStaff below - a note's author should still
    // show their name after they've left the firm, same reasoning as the
    // conflict-check history page.
    supabase.from('staff_directory').select('id, full_name'),
    supabase.rpc('has_permission', { p_key: 'expenses_manage' }),
    supabase
      .from('expenses')
      .select('id, description, amount, incurred_at, reimbursed, reimbursed_at, recorded_by')
      .eq('case_id', id)
      .order('incurred_at', { ascending: false }),
    supabase.rpc('case_timeline', { p_case_id: id }),
  ])

  // staff_directory is a view, so its columns come back nullable in the
  // generated types even though the underlying staff.id/full_name are not -
  // filter defensively rather than loosen the types everywhere else.
  const activeStaff = (staffDirectory ?? []).filter(
    (s): s is { id: string; full_name: string } => s.id !== null && s.full_name !== null
  )
  const nameById = new Map(activeStaff.map((s) => [s.id, s.full_name]))
  const staffNameById = Object.fromEntries(nameById)
  const team = (teamRows ?? []).map((t) => ({
    staff_id: t.staff_id,
    is_lead: t.is_lead,
    full_name: nameById.get(t.staff_id) ?? 'Unknown staff',
  }))

  const deadlines = (deadlineRows ?? []).map((d) => ({
    id: d.id,
    trigger_date: d.trigger_date,
    due_date: d.due_date,
    unadjusted_due_date: d.unadjusted_due_date,
    effective_due_date: d.effective_due_date,
    extended_due_date: d.extended_due_date,
    extension_reason: d.extension_reason,
    extended_by_name: d.extended_by ? (nameById.get(d.extended_by) ?? 'Unknown staff') : null,
    extended_at: d.extended_at,
    description: d.description,
    period_type_name: d.deadline_period_types?.name ?? 'Unknown period',
    period_days: d.deadline_period_types?.period_days ?? 0,
  }))

  const allNameById = new Map(
    (allStaffDirectory ?? [])
      .filter((s): s is { id: string; full_name: string } => s.id !== null && s.full_name !== null)
      .map((s) => [s.id, s.full_name])
  )

  const notes: CaseNote[] = (noteRows ?? []).map((n) => ({
    id: n.id,
    note: n.note,
    created_at: n.created_at,
    edited_at: n.edited_at,
    author_name: n.staff_id ? (allNameById.get(n.staff_id) ?? 'Unknown staff') : 'Unknown staff',
    deleted_at: n.deleted_at,
    deleted_by_name: n.deleted_by ? (allNameById.get(n.deleted_by) ?? 'Unknown staff') : null,
  }))

  const documents: DocumentRow[] = (documentRows ?? []).map((d) => ({
    id: d.id,
    filename: d.filename,
    uploaded_at: d.uploaded_at,
    uploaded_by_name: d.uploaded_by ? (nameById.get(d.uploaded_by) ?? 'Unknown staff') : 'Unknown staff',
    deleted_at: d.deleted_at,
    deleted_by_name: d.deleted_by ? (allNameById.get(d.deleted_by) ?? 'Unknown staff') : null,
  }))

  const expenses: Expense[] = (expenseRows ?? []).map((e) => ({
    id: e.id,
    description: e.description,
    amount: e.amount,
    incurred_at: e.incurred_at,
    reimbursed: e.reimbursed,
    reimbursed_at: e.reimbursed_at,
    recorded_by_name: e.recorded_by ? (allNameById.get(e.recorded_by) ?? 'Unknown staff') : 'Unknown staff',
  }))

  const timeline: TimelineRow[] = (timelineRows ?? []).map((row) => ({
    id: row.id,
    occurred_at: row.occurred_at,
    action: row.action,
    entity: row.entity,
    actor_name: row.actor_name,
    detail: (row.detail as Record<string, unknown> | null) ?? null,
    detail_redacted: row.detail_redacted,
  }))

  return (
    <div className="flex flex-col gap-8">
      <div>
        <BackLink href="/dashboard/cases" label="Cases" />
        <PageHeader
          title={`${caseRow.case_number} — ${caseRow.title}`}
          description={`Client: ${caseRow.clients?.full_name ?? '—'}${caseRow.case_type ? ` · ${caseRow.case_type}` : ''}`}
        />
      </div>

      <StatusSection caseId={caseRow.id} currentStatusId={caseRow.status_id} statuses={statuses ?? []} />

      <TeamSection caseId={caseRow.id} team={team} availableStaff={activeStaff} />

      <OpposingPartiesSection caseId={caseRow.id} parties={opposingParties ?? []} />

      <DeadlinesSection caseId={caseRow.id} deadlines={deadlines} periodTypes={periodTypes ?? []} />

      <ShareLinksSection caseId={caseRow.id} links={shareLinks ?? []} />

      <DocumentsSection caseId={caseRow.id} documents={documents} />

      <NotesSection caseId={caseRow.id} notes={notes} />

      {/* Not gated on "the query came back empty" - lawyers don't hold
          expenses_manage in the seeded roles, so this checks the permission
          explicitly rather than inferring access from an empty result. */}
      {canManageExpenses && <ExpensesSection caseId={caseRow.id} expenses={expenses} />}

      {timelineError ? (
        <p className="text-sm text-fg-muted">Timeline unavailable: {timelineError.message}</p>
      ) : (
        <TimelineSection rows={timeline} staffNameById={staffNameById} />
      )}
    </div>
  )
}
