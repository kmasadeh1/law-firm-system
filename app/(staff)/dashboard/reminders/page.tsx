import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getStaffLocale } from '@/lib/get-staff-locale'
import { PageHeader } from '@/components/dashboard/page-header'
import { EmptyState } from '@/components/dashboard/empty-state'
import { formatAmount } from '@/lib/format-money'
import { formatDate, formatDateTime, formatFullDate, formatTimeOfDay } from '@/lib/format-date-time'
import { localizedName } from '@/lib/localized-name'
import { whatsappLink } from '@/lib/whatsapp'
import type { Database } from '@/lib/supabase/database.types'
import { ReminderGroup, type ReminderRow } from './reminder-list'

type ReminderKind = Database['public']['Enums']['reminder_kind']

const KIND_ORDER: ReminderKind[] = ['hearing', 'appointment', 'payment_due']

const CANDIDATE_COLUMNS =
  'kind, subject_id, client_id, client_name, client_phone, case_id, case_number, due_on, due_time, detail_en, detail_ar, amount, last_reminded_at, reminded_recently'

// Prepared WhatsApp reminders, reviewed and sent by a person one at a time.
// Nothing here sends anything: each row's link opens WhatsApp with the
// message pre-filled, and "Mark as sent" is a separate, explicit record.
// No select-all, no send-all.
//
// No access gate: reminder_candidates is security_invoker and already
// limits each kind to what this reader may see. An empty page is a normal
// state, not "no access".
//
// The prepared message is built here, from message files, and is never
// stored. It is in the staff member's own language for now, only because
// clients have no stored language preference - the agreed fix is a
// language column on clients (a separate change), since a client's
// language doesn't depend on who happens to send the reminder.
export default async function RemindersPage() {
  const supabase = await createClient()
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.reminders' })
  const tShell = await getTranslations({ locale, namespace: 'dashboard.shell' })

  // One query, ordered by the database: rows not reminded recently first,
  // then the recently reminded below them (reminded_recently is computed by
  // the view - never null, false when there's no reminder at all), each by
  // date. Recently reminded rows are dampened, never hidden.
  const { data: candidateRows } = await supabase
    .from('reminder_candidates')
    .select(CANDIDATE_COLUMNS)
    .order('reminded_recently', { ascending: true })
    .order('due_on', { ascending: true })
    .order('due_time', { ascending: true, nullsFirst: false })
    .order('client_name', { ascending: true })

  const firm = tShell('firmName')

  function prepare(row: NonNullable<typeof candidateRows>[number]): ReminderRow | null {
    if (!row.kind || !row.subject_id || !row.client_id) return null
    const client = row.client_name ?? ''
    const detail =
      row.detail_en || row.detail_ar
        ? localizedName({ name: row.detail_en ?? row.detail_ar ?? '', name_ar: row.detail_ar }, locale)
        : null
    const fullDate = row.due_on ? formatFullDate(row.due_on, locale) : ''
    const amount = row.amount !== null ? formatAmount(row.amount, locale) : null
    // due_time is the Amman local time (a bare time value), null for a
    // payment and for a hearing with no time recorded.
    const time = row.due_time ? formatTimeOfDay(row.due_time, locale) : null

    const bdi = (chunks: React.ReactNode) => <bdi>{chunks}</bdi>
    let message: string
    let about: React.ReactNode
    switch (row.kind) {
      case 'hearing':
        message = t('message.hearing', { client, firm, caseNumber: row.case_number ?? '', court: detail ?? '', date: fullDate })
        about = t.rich('about.hearing', { caseNumber: row.case_number ?? '', court: detail ?? '', bdi })
        break
      case 'appointment':
        message = time
          ? t('message.appointment', { client, firm, date: fullDate, time })
          : t('message.appointmentNoTime', { client, firm, date: fullDate })
        about = row.case_number ? t.rich('about.appointmentOnCase', { caseNumber: row.case_number, bdi }) : t('about.appointment')
        break
      case 'payment_due':
        message = t('message.payment_due', { client, firm, amount: amount ?? '', description: detail ?? '', date: fullDate })
        about = t.rich('about.payment_due', { description: detail ?? '', bdi })
        break
    }

    return {
      key: `${row.kind}:${row.subject_id}`,
      kind: row.kind,
      subjectId: row.subject_id,
      clientId: row.client_id,
      clientName: client,
      phone: row.client_phone,
      about,
      date: row.due_on ? formatDate(row.due_on, locale) : null,
      time,
      amount,
      lastReminded: row.last_reminded_at ? formatDateTime(row.last_reminded_at, locale) : null,
      recent: row.reminded_recently === true,
      // null when there's no usable phone number - the row then explains
      // why it can't be reminded instead of offering a dead link.
      whatsappHref: whatsappLink(row.client_phone, message),
    }
  }

  const rows = (candidateRows ?? []).map(prepare).filter((r): r is ReminderRow => r !== null)
  // Display grouping only: each kind keeps the order the queries produced
  // (not reminded recently first, then the recently reminded).
  const groups = KIND_ORDER.map((kind) => ({ kind, rows: rows.filter((r) => r.kind === kind) })).filter(
    (g) => g.rows.length > 0
  )

  return (
    <div className="flex flex-col gap-6" data-testid="reminders-page">
      <PageHeader title={t('title')} description={t('description')} />

      {groups.length === 0 ? (
        <EmptyState title={t('emptyTitle')} description={t('emptyDescription')} />
      ) : (
        groups.map((group) => (
          <ReminderGroup key={group.kind} title={t(`group.${group.kind}`)} kind={group.kind} rows={group.rows} />
        ))
      )}
    </div>
  )
}
