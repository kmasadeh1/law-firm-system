import { createClient } from '@/lib/supabase/server'
import { BackLink } from '@/components/dashboard/back-link'
import { PageHeader } from '@/components/dashboard/page-header'
import { StatusSection } from './status-section'
import { TeamSection } from './team-section'
import { OpposingPartiesSection } from './opposing-parties-section'

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

  const [{ data: statuses }, { data: teamRows }, { data: staffDirectory }, { data: opposingParties }] =
    await Promise.all([
      supabase.from('case_statuses').select('id, name, is_terminal').order('sort_order'),
      supabase.from('case_lawyers').select('staff_id, is_lead').eq('case_id', id),
      supabase.from('staff_directory').select('id, full_name').eq('is_active', true).order('full_name'),
      supabase.from('case_opposing_parties').select('id, name, national_id').eq('case_id', id),
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
    </div>
  )
}
