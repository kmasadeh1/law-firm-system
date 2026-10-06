import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { BackLink } from '@/components/dashboard/back-link'
import { PageHeader } from '@/components/dashboard/page-header'
import { Panel } from '@/components/dashboard/panel'
import { AssignSection } from './assign-section'
import { StatusSection } from './status-section'
import { NotesSection, type EnquiryNote } from './notes-section'
import { formatDateTime } from '@/lib/format-date-time'
import { getStaffLocale } from '@/lib/get-staff-locale'
import type { Database } from '@/lib/supabase/database.types'

type EnquiryNoteRow = Pick<
  Database['public']['Tables']['enquiry_notes']['Row'],
  'id' | 'note' | 'created_at' | 'staff_id' | 'edited_at' | 'deleted_at' | 'deleted_by'
> & { can_edit_enquiry_note: boolean | null }

export default async function EnquiryDetailPage({ params }: PageProps<'/dashboard/enquiries/[id]'>) {
  const { id } = await params
  const supabase = await createClient()
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.enquiries' })
  const tCommon = await getTranslations({ locale, namespace: 'dashboard.common' })

  // No access gate here either - a row RLS hides looks identical to one
  // that doesn't exist, same as the Clients edit page. can_access_enquiry
  // is asked directly rather than inferred from assigned_to/user_type in
  // this component - the database answers "who can see this", the page
  // only renders what it's told.
  const [
    { data: enquiry },
    { data: canManage },
    { data: canAccess },
    { data: isOwner },
    { data: staffDirectory },
    { data: allStaffDirectory },
    { data: noteRows },
  ] = await Promise.all([
    supabase
      .from('enquiries')
      .select('id, name, phone, email, message, status, assigned_to, created_at')
      .eq('id', id)
      .maybeSingle(),
    supabase.rpc('has_permission', { p_key: 'enquiries_manage' }),
    supabase.rpc('can_access_enquiry', { p_enquiry_id: id }),
    supabase.rpc('is_owner'),
    // Active only, matching the case team-assignment convention - you
    // wouldn't assign new work to someone who's left the firm.
    supabase.from('staff_directory').select('id, full_name').eq('is_active', true).order('full_name'),
    // Unfiltered - an assignee or a note's author should still show their
    // name after they've left the firm, same reasoning as case notes.
    supabase.from('staff_directory').select('id, full_name'),
    supabase
      .from('enquiry_notes')
      // can_edit_enquiry_note is a computed column (a row-type function):
      // the database's per-note answer to who may edit or delete it. It is
      // not part of '*', so it is named here. The generated types list it
      // under Functions but not on the table's Row, so the row shape is
      // stated rather than inferred.
      .select('id, note, created_at, staff_id, edited_at, deleted_at, deleted_by, can_edit_enquiry_note')
      .eq('enquiry_id', id)
      .order('created_at', { ascending: false })
      .overrideTypes<EnquiryNoteRow[], { merge: false }>(),
  ])

  if (!enquiry) {
    return (
      <div className="flex flex-col gap-6">
        <BackLink href="/dashboard/enquiries" label={t('list.title')} />
        <p className="text-sm text-fg-muted">{t('detail.notFound')}</p>
      </div>
    )
  }

  const staffOptions = (staffDirectory ?? []).filter(
    (s): s is { id: string; full_name: string } => s.id !== null && s.full_name !== null
  )
  const nameById = new Map(
    (allStaffDirectory ?? [])
      .filter((s): s is { id: string; full_name: string } => s.id !== null && s.full_name !== null)
      .map((s) => [s.id, s.full_name])
  )

  // Explicit application-layer filter, not just RLS: deleted enquiry notes
  // are only meant to be visible (for restore) to the owner. enquiry_notes'
  // own read policy doesn't hide deleted rows - hiding them here is the
  // only thing that does, same lesson as case notes/documents.
  const visibleNoteRows = isOwner ? (noteRows ?? []) : (noteRows ?? []).filter((n) => !n.deleted_at)

  const notes: EnquiryNote[] = visibleNoteRows.map((n) => ({
    id: n.id,
    note: n.note,
    created_at: n.created_at,
    edited_at: n.edited_at,
    author_name: n.staff_id ? (nameById.get(n.staff_id) ?? tCommon('unknownStaff')) : tCommon('unknownStaff'),
    deleted_at: n.deleted_at,
    deleted_by_name: n.deleted_by ? (nameById.get(n.deleted_by) ?? tCommon('unknownStaff')) : null,
    can_modify: n.can_edit_enquiry_note === true,
  }))

  return (
    <div className="flex flex-col gap-8">
      <div>
        <BackLink href="/dashboard/enquiries" label={t('list.title')} />
        <PageHeader
          title={enquiry.name}
          description={t.rich('detail.receivedLine', {
            date: formatDateTime(enquiry.created_at, locale),
            bdi: (chunks) => <bdi>{chunks}</bdi>,
          })}
        />
      </div>

      <Panel className="flex flex-col gap-3">
        <h2 className="font-heading text-lg text-fg">{t('detail.messageHeading')}</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          {enquiry.phone && (
            <>
              <dt className="text-fg-muted">{t('detail.phoneLabel')}</dt>
              <dd className="text-fg" dir="ltr">
                {enquiry.phone}
              </dd>
            </>
          )}
          {enquiry.email && (
            <>
              <dt className="text-fg-muted">{t('detail.emailLabel')}</dt>
              <dd className="text-fg" dir="ltr">
                {enquiry.email}
              </dd>
            </>
          )}
        </dl>
        <p className="whitespace-pre-wrap text-sm text-fg">{enquiry.message}</p>
      </Panel>

      <AssignSection
        enquiryId={enquiry.id}
        currentAssignedTo={enquiry.assigned_to}
        currentAssignedName={enquiry.assigned_to ? (nameById.get(enquiry.assigned_to) ?? tCommon('unknownStaff')) : null}
        staffOptions={staffOptions}
        canManage={canManage === true}
      />

      <StatusSection enquiryId={enquiry.id} currentStatus={enquiry.status} canAccess={canAccess === true} />

      {canAccess === true && <NotesSection enquiryId={enquiry.id} notes={notes} canRestore={isOwner === true} />}
    </div>
  )
}
