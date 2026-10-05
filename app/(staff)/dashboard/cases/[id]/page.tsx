import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { BackLink } from '@/components/dashboard/back-link'
import { PageHeader } from '@/components/dashboard/page-header'
import { getStaffLocale } from '@/lib/get-staff-locale'
import { localizedName } from '@/lib/localized-name'
import { StatusSection } from './status-section'
import { TeamSection } from './team-section'
import { OpposingPartiesSection } from './opposing-parties-section'
import { CourtAndDeadlines } from './court-and-deadlines'
import type { CourtFiling } from './court-section'
import { PowerOfAttorneyLine } from './power-of-attorney-line'
import { mostRelevantPoa } from '@/lib/poa-status'
import { TasksSection } from './tasks-section'
import type { Task } from '../../tasks/task-list'
import { ShareLinksSection } from './share-links-section'
import { DocumentsSection, type DocumentRow } from './documents-section'
import { NotesSection, type CaseNote } from './notes-section'
import { ExpensesSection, type Expense } from './expenses-section'
import { TimelineSection, type TimelineRow } from './timeline-section'
import { ContactLogSection } from '../../clients/contact-log-section'
import { CONTACT_LOG_SELECT, toContactRow, type ContactQueryRow } from '../../clients/contact-log-query'

export default async function CaseDetailPage({ params }: PageProps<'/dashboard/cases/[id]'>) {
  const { id } = await params
  const supabase = await createClient()
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.cases.detail.page' })
  const tCommon = await getTranslations({ locale, namespace: 'dashboard.common' })

  // No access gate here either - a row RLS hides looks identical to one
  // that doesn't exist, same as the Clients edit page.
  // can_change_case_status / can_close_case only need the route's id, so
  // they ride in this first wave rather than the permission wave below:
  // the status options query in that wave is filtered by their answers,
  // which would otherwise cost a second sequential round trip. Both are
  // the database's own rules (the cases UPDATE policy, and what
  // enforce_case_close_permission enforces) and already include the owner -
  // never OR'd with isOwner.
  const [{ data: caseRow }, { data: claimsData }, { data: canChangeStatus }, { data: canCloseCase }] = await Promise.all([
    supabase
      .from('cases')
      .select(
        'id, case_number, title, case_type_id, case_types(name_en, name_ar), status_id, opened_at, closed_at, clients(id, full_name)'
      )
      .eq('id', id)
      .maybeSingle(),
    supabase.auth.getClaims(),
    supabase.rpc('can_change_case_status', { p_case_id: id }),
    supabase.rpc('can_close_case', { p_case_id: id }),
  ])

  const viewerId = claimsData?.claims?.sub as string | undefined
  const { data: viewerStaffRow } = viewerId
    ? await supabase.from('staff').select('user_type').eq('id', viewerId).maybeSingle()
    : { data: null }
  const isOwner = viewerStaffRow?.user_type === 'owner'

  if (!caseRow) {
    return (
      <div className="flex flex-col gap-6">
        <BackLink href="/dashboard/cases" label={t('backToCases')} />
        <p className="text-sm text-fg-muted">{t('caseNotFound')}</p>
      </div>
    )
  }

  // The status options are filtered in the query by what the database will
  // accept, never in the component:
  // - can't change the status at all: only the current status, for display
  //   as plain text;
  // - can change but not close: non-terminal statuses only, plus the
  //   current one so the picker shows the case's real status (re-saving an
  //   already-closed case never fires the close check);
  // - can close: every status.
  function statusOptionsQuery() {
    const query = supabase.from('case_statuses').select('id, name, name_ar, is_terminal').order('sort_order')
    if (canChangeStatus !== true) return query.eq('id', caseRow!.status_id)
    if (canCloseCase !== true) return query.or(`is_terminal.eq.false,id.eq.${caseRow!.status_id}`)
    return query
  }

  const [
    { data: statuses },
    { data: teamRows },
    { data: staffDirectory },
    { data: opposingParties },
    { data: activeCourts },
    { data: courtFilingRows },
    { data: deadlineRows },
    { data: periodTypes },
    { data: shareLinks },
    { data: documentRows },
    { data: noteRows },
    { data: allStaffDirectory },
    { data: canManageExpenses },
    { data: expenseRows },
    { data: expenseTotalsRow },
    { data: timelineRows, error: timelineError },
    { data: canManageCaseDetails },
    { data: canManageShareLinks },
    { data: canWriteDocuments },
    { data: canWriteNotes },
    { data: poaRows },
    { data: canAssignTasks },
    { data: taskRows },
    { data: contactRows },
    { data: canViewClient },
    { data: clientCases },
  ] = await Promise.all([
    statusOptionsQuery(),
    supabase.from('case_lawyers').select('staff_id, is_lead').eq('case_id', id),
    supabase.from('staff_directory').select('id, full_name').eq('is_active', true).order('full_name'),
    supabase
      .from('case_opposing_parties')
      .select('id, name, national_id, counsel_name, counsel_phone')
      .eq('case_id', id),
    // Picker options for the add form - inactive courts are excluded here
    // but an existing filing's own court still comes through the join below
    // regardless of is_active, so an already-recorded filing never loses its
    // court just because that court was later deactivated.
    supabase
      .from('courts')
      .select('id, name_en, name_ar')
      .eq('is_active', true)
      .order('sort_order', { nullsFirst: false })
      .order('name_en'),
    supabase
      .from('case_court_filings')
      .select(
        'id, court_id, court_case_number, chamber, judge_name, filed_at, is_current, notes, courts(id, name_en, name_ar), hearings(id, filing_id, session_date, session_time, outcome, what_happened, decision, next_session_date, attended_by, notified_at)'
      )
      .eq('case_id', id)
      .order('filed_at', { ascending: false, nullsFirst: false }),
    supabase
      .from('deadlines')
      .select(
        'id, trigger_date, due_date, unadjusted_due_date, effective_due_date, extended_due_date, extension_reason, extended_by, extended_at, description, deadline_period_types(name, name_ar, period_days)'
      )
      .eq('case_id', id)
      .order('effective_due_date', { ascending: true, nullsFirst: false }),
    supabase.from('deadline_period_types').select('id, name, name_ar, period_days, description').order('name'),
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
    // Totals come from expense_totals, never summed here - it LEFT JOINs
    // from cases so a case with none still returns a zeroed row, and is
    // security_invoker so it respects the same RLS as expenses itself.
    supabase.from('expense_totals').select('total_incurred, total_reimbursed, total_outstanding').eq('case_id', id).maybeSingle(),
    supabase.rpc('case_timeline', { p_case_id: id }),
    // Each of these is asked once, here, rather than inside its section or
    // per row - all four are STABLE and already return true for the owner
    // on their own, so nothing here ORs them with isOwner (that's the
    // exact anti-pattern this task exists to remove).
    supabase.rpc('can_manage_case_details', { p_case_id: id }),
    supabase.rpc('can_manage_case_share_links', { p_case_id: id }),
    supabase.rpc('can_write_case_documents', { p_case_id: id }),
    supabase.rpc('can_write_case_notes', { p_case_id: id }),
    // Every PoA this case could be covered by: this case's own
    // case-specific rows, plus the client's general ones (case_id IS NULL).
    // RLS already scopes this to what the viewer may see; which one
    // actually covers the case is picked below from what comes back.
    caseRow.clients?.id
      ? supabase
          .from('powers_of_attorney')
          .select('id, case_id, poa_number, issued_at, expires_at, is_revoked')
          .or(`case_id.eq.${id},and(case_id.is.null,client_id.eq.${caseRow.clients.id})`)
      : Promise.resolve({ data: null, error: null }),
    // STABLE, already true for the owner internally - resolved once here,
    // never OR'd with isOwner.
    supabase.rpc('can_assign_tasks'),
    // RLS already limits this to owner/assignee/creator rows for this case -
    // no status filter here, unlike the standalone Tasks page: a case's own
    // task list is small enough that showing everything is the point.
    supabase
      .from('tasks')
      .select('id, title, details, case_id, assigned_to, due_date, status, priority, created_by')
      .eq('case_id', id)
      .order('due_date', { ascending: true, nullsFirst: false }),
    // Contacts linked to this case only; deleted ones filtered in the
    // query, not the component (RLS still returns them, deliberately).
    supabase
      .from('client_contacts')
      .select(CONTACT_LOG_SELECT)
      .eq('case_id', id)
      .is('deleted_at', null)
      .order('occurred_at', { ascending: false })
      .order('created_at', { ascending: false })
      .returns<ContactQueryRow[]>(),
    // The contact log's add gate - the insert policy's own test. Asked
    // about the case's client, since a contact belongs to the client.
    caseRow.clients?.id
      ? supabase.rpc('can_view_client', { p_client_id: caseRow.clients.id })
      : Promise.resolve({ data: false, error: null }),
    // The client's other cases, for the contact form's case picker - a
    // contact logged here can still be re-pointed at a sibling case.
    caseRow.clients?.id
      ? supabase.from('cases').select('id, case_number, title').eq('client_id', caseRow.clients.id).order('case_number')
      : Promise.resolve({ data: null, error: null }),
  ])

  // staff_directory is a view, so its columns come back nullable in the
  // generated types even though the underlying staff.id/full_name are not -
  // filter defensively rather than loosen the types everywhere else.
  const activeStaff = (staffDirectory ?? []).filter(
    (s): s is { id: string; full_name: string } => s.id !== null && s.full_name !== null
  )
  const nameById = new Map(activeStaff.map((s) => [s.id, s.full_name]))
  const staffNameById = Object.fromEntries(nameById)
  const team = (teamRows ?? []).map((row) => ({
    staff_id: row.staff_id,
    is_lead: row.is_lead,
    full_name: nameById.get(row.staff_id) ?? tCommon('unknownStaff'),
  }))

  // Case-specific wins over the client's general وكالة, never the other way
  // - "otherwise" chain over rows already fetched, not a second query.
  const caseSpecificPoa = mostRelevantPoa((poaRows ?? []).filter((p) => p.case_id === id))
  const generalPoa = mostRelevantPoa((poaRows ?? []).filter((p) => p.case_id === null))
  const coveringPoaRow = caseSpecificPoa ?? generalPoa
  const coveringPoa = coveringPoaRow
    ? {
        poa_number: coveringPoaRow.poa_number,
        issued_at: coveringPoaRow.issued_at,
        expires_at: coveringPoaRow.expires_at,
        is_revoked: coveringPoaRow.is_revoked,
        is_general: coveringPoaRow.case_id === null,
      }
    : null

  const courtFilings: CourtFiling[] = (courtFilingRows ?? [])
    .filter((f) => f.courts !== null)
    .map((f) => ({
      id: f.id,
      court_id: f.court_id,
      court: f.courts!,
      court_case_number: f.court_case_number,
      chamber: f.chamber,
      judge_name: f.judge_name,
      filed_at: f.filed_at,
      is_current: f.is_current,
      notes: f.notes,
      // Embedded collections come back in no guaranteed order - sorted here
      // (oldest first, a chronological log) rather than relying on Postgres
      // to have returned them that way.
      hearings: [...(f.hearings ?? [])].sort((a, b) => a.session_date.localeCompare(b.session_date)),
    }))

  const deadlines = (deadlineRows ?? []).map((d) => ({
    id: d.id,
    trigger_date: d.trigger_date,
    due_date: d.due_date,
    unadjusted_due_date: d.unadjusted_due_date,
    effective_due_date: d.effective_due_date,
    extended_due_date: d.extended_due_date,
    extension_reason: d.extension_reason,
    extended_by_name: d.extended_by ? (nameById.get(d.extended_by) ?? tCommon('unknownStaff')) : null,
    extended_at: d.extended_at,
    description: d.description,
    period_type_name: d.deadline_period_types ? localizedName(d.deadline_period_types, locale) : t('unknownPeriod'),
    period_days: d.deadline_period_types?.period_days ?? 0,
  }))

  const allNameById = new Map(
    (allStaffDirectory ?? [])
      .filter((s): s is { id: string; full_name: string } => s.id !== null && s.full_name !== null)
      .map((s) => [s.id, s.full_name])
  )

  const tasks: Task[] = (taskRows ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    details: row.details,
    case_id: row.case_id,
    case_number: null,
    case_title: null,
    assigned_to: row.assigned_to,
    assignee_name: allNameById.get(row.assigned_to) ?? tCommon('unknownStaff'),
    due_date: row.due_date,
    status: row.status,
    priority: row.priority,
    created_by: row.created_by,
    creator_name: allNameById.get(row.created_by) ?? tCommon('unknownStaff'),
  }))

  // Explicit application-layer filter, not just RLS: the "Deleted notes"
  // section below this page's notes/documents lists is owner-only by
  // design (restoring a deleted note or document is an owner capability),
  // and its entire gate used to be "RLS never returns a deleted row to
  // anyone but the owner in the first place" - a query-level assumption,
  // not a check this code made itself. Keeping that gate here too means
  // this page still hides deleted rows from a non-owner even if the RLS
  // policy that used to do it changes for an unrelated reason (e.g. to
  // stop blocking the delete action itself, per the deleted_at IS NULL OR
  // is_owner() clause's dual role as both a read-visibility rule and an
  // accidental write-blocker).
  const visibleNoteRows = isOwner ? (noteRows ?? []) : (noteRows ?? []).filter((n) => !n.deleted_at)
  const visibleDocumentRows = isOwner ? (documentRows ?? []) : (documentRows ?? []).filter((d) => !d.deleted_at)

  const notes: CaseNote[] = visibleNoteRows.map((n) => ({
    id: n.id,
    note: n.note,
    created_at: n.created_at,
    edited_at: n.edited_at,
    author_name: n.staff_id ? (allNameById.get(n.staff_id) ?? tCommon('unknownStaff')) : tCommon('unknownStaff'),
    deleted_at: n.deleted_at,
    deleted_by_name: n.deleted_by ? (allNameById.get(n.deleted_by) ?? tCommon('unknownStaff')) : null,
  }))

  const documents: DocumentRow[] = visibleDocumentRows.map((d) => ({
    id: d.id,
    filename: d.filename,
    uploaded_at: d.uploaded_at,
    uploaded_by_name: d.uploaded_by ? (nameById.get(d.uploaded_by) ?? tCommon('unknownStaff')) : tCommon('unknownStaff'),
    deleted_at: d.deleted_at,
    deleted_by_name: d.deleted_by ? (allNameById.get(d.deleted_by) ?? tCommon('unknownStaff')) : null,
  }))

  const expenses: Expense[] = (expenseRows ?? []).map((e) => ({
    id: e.id,
    description: e.description,
    amount: e.amount,
    incurred_at: e.incurred_at,
    reimbursed: e.reimbursed,
    reimbursed_at: e.reimbursed_at,
    recorded_by_name: e.recorded_by ? (allNameById.get(e.recorded_by) ?? tCommon('unknownStaff')) : tCommon('unknownStaff'),
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

  const contacts = (contactRows ?? []).map((c) => toContactRow(c, allNameById, tCommon('unknownStaff')))

  const caseTypeName = caseRow.case_types
    ? localizedName({ name: caseRow.case_types.name_en ?? '', name_ar: caseRow.case_types.name_ar }, locale)
    : null

  return (
    <div className="flex flex-col gap-8">
      <div>
        <BackLink href="/dashboard/cases" label={t('backToCases')} />
        <PageHeader
          title={
            <>
              <bdi>{caseRow.case_number}</bdi> — <bdi>{caseRow.title}</bdi>
            </>
          }
          description={t.rich('description', {
            hasType: caseTypeName ? 'yes' : 'other',
            name: caseRow.clients?.full_name ?? '—',
            caseType: caseTypeName ?? '',
            bdi: (chunks) => <bdi>{chunks}</bdi>,
          })}
        />
      </div>

      <StatusSection
        caseId={caseRow.id}
        currentStatusId={caseRow.status_id}
        statuses={statuses ?? []}
        canChange={canChangeStatus === true}
      />

      <TeamSection
        caseId={caseRow.id}
        team={team}
        availableStaff={activeStaff}
        canManage={canManageCaseDetails === true}
      />

      <OpposingPartiesSection
        caseId={caseRow.id}
        parties={opposingParties ?? []}
        canManage={canManageCaseDetails === true}
      />

      <PowerOfAttorneyLine poa={coveringPoa} />

      <CourtAndDeadlines
        caseId={caseRow.id}
        filings={courtFilings}
        courts={activeCourts ?? []}
        deadlines={deadlines}
        periodTypes={periodTypes ?? []}
        canManage={canManageCaseDetails === true}
        staffOptions={activeStaff}
      />

      <TasksSection caseId={caseRow.id} tasks={tasks} staffOptions={activeStaff} canAssign={canAssignTasks === true} />

      <ShareLinksSection caseId={caseRow.id} links={shareLinks ?? []} canManage={canManageShareLinks === true} />

      <DocumentsSection caseId={caseRow.id} documents={documents} canWrite={canWriteDocuments === true} />

      <NotesSection caseId={caseRow.id} notes={notes} canWrite={canWriteNotes === true} />

      {caseRow.clients?.id && (
        <ContactLogSection
          clientId={caseRow.clients.id}
          contacts={contacts}
          cases={clientCases ?? []}
          staffOptions={activeStaff}
          canAdd={canViewClient === true}
          defaultCaseId={caseRow.id}
          defaultHandledBy={viewerId ?? null}
          showCase={false}
          testId="case-contacts-section"
        />
      )}

      {/* Not gated on "the query came back empty" - lawyers don't hold
          expenses_manage in the seeded roles, so this checks the permission
          explicitly rather than inferring access from an empty result. */}
      {canManageExpenses && (
        <ExpensesSection
          caseId={caseRow.id}
          expenses={expenses}
          totals={{
            incurred: expenseTotalsRow?.total_incurred ?? 0,
            reimbursed: expenseTotalsRow?.total_reimbursed ?? 0,
            outstanding: expenseTotalsRow?.total_outstanding ?? 0,
          }}
        />
      )}

      {timelineError ? (
        <p className="text-sm text-fg-muted">
          {t.rich('timelineUnavailable', {
            message: timelineError.message,
            bdi: (chunks) => <bdi>{chunks}</bdi>,
          })}
        </p>
      ) : (
        <TimelineSection rows={timeline} staffNameById={staffNameById} />
      )}
    </div>
  )
}
