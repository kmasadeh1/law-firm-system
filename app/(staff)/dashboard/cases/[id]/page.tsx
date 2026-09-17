import { createClient } from '@/lib/supabase/server'
import { BackLink } from '@/components/dashboard/back-link'
import { PageHeader } from '@/components/dashboard/page-header'
import { StatusSection } from './status-section'
import { TeamSection } from './team-section'
import { OpposingPartiesSection } from './opposing-parties-section'
import { DeadlinesSection } from './deadlines-section'

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
  ])

  // staff_directory is a view, so its columns come back nullable in the
  // generated types even though the underlying staff.id/full_name are not -
  // filter defensively rather than loosen the types everywhere else.
  const activeStaff = (staffDirectory ?? []).filter(
    (s): s is { id: string; full_name: string } => s.id !== null && s.full_name !== null
  )
  const nameById = new Map(activeStaff.map((s) => [s.id, s.full_name]))
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
    </div>
  )
}
