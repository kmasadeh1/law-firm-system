import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getStaffLocale } from '@/lib/get-staff-locale'
import { PageHeader } from '@/components/dashboard/page-header'
import { EmptyState } from '@/components/dashboard/empty-state'
import { formatAmount } from '@/lib/format-money'
import { formatDate, formatDateTime, formatFullDate, formatTime } from '@/lib/format-date-time'
import { localizedName } from '@/lib/localized-name'
import { whatsappLink } from '@/lib/whatsapp'
import type { Database } from '@/lib/supabase/database.types'
import { ReminderGroup, type ReminderRow } from './reminder-list'

type ReminderKind = Database['public']['Enums']['reminder_kind']

const KIND_ORDER: ReminderKind[] = ['hearing', 'appointment', 'payment_due']

const CANDIDATE_COLUMNS =
  'kind, subject_id, client_id, client_name, client_phone, case_id, case_number, due_on, detail_en, detail_ar, amount, last_reminded_at'

// Prepared WhatsApp reminders, reviewed and sent by a person one at a time.
// Nothing here sends anything: each row's link opens WhatsApp with the
// message pre-filled, and "Mark as sent" is a separate, explicit record.
// No select-all, no send-all.
//
// No access gate: reminder_candidates is security_invoker and already
// limits each kind to what this reader may see. An empty page is a normal
// state, not "no access".
//
// The prepared message is built here, from message files, in the staff
// member's own language - clients have no stored language preference. It
// is never stored.
export default async function RemindersPage() {
  const supabase = await createClient()
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.reminders' })
  const tShell = await getTranslations({ locale, namespace: 'dashboard.shell' })

  // "Reminded in the last 24 hours" is decided by the database: the cutoff
  // instant is passed in and the comparison runs in the query, which also
  // does the sorting - recently reminded rows come from their own query and
  // are placed below the rest. They are dampened, never hidden.
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const [{ data: freshRows }, { data: recentRows }] = await Promise.all([
    supabase
      .from('reminder_candidates')
      .select(CANDIDATE_COLUMNS)
      .or(`last_reminded_at.is.null,last_reminded_at.lt."${cutoff}"`)
      .order('due_on', { ascending: true })
      .order('client_name', { ascending: true }),
    supabase
      .from('reminder_candidates')
      .select(CANDIDATE_COLUMNS)
      .gte('last_reminded_at', cutoff)
      .order('last_reminded_at', { ascending: true }),
  ])

  const candidates = [
    ...(freshRows ?? []).map((row) => ({ row, recent: false })),
    ...(recentRows ?? []).map((row) => ({ row, recent: true })),
  ]

  // The view carries an appointment's Amman date but not its time; a
  // reminder without the time is incomplete, so the time is read from the
  // appointments themselves (RLS applies as everywhere).
  const appointmentIds = candidates
    .filter(({ row }) => row.kind === 'appointment' && row.subject_id)
    .map(({ row }) => row.subject_id as string)
  const { data: appointments } = appointmentIds.length
    ? await supabase.from('appointments').select('id, starts_at').in('id', appointmentIds)
    : { data: [] }
  const startsAtById = new Map((appointments ?? []).map((a) => [a.id, a.starts_at]))

  const firm = tShell('firmName')

  function prepare({ row, recent }: (typeof candidates)[number]): ReminderRow | null {
    if (!row.kind || !row.subject_id || !row.client_id) return null
    const client = row.client_name ?? ''
    const detail =
      row.detail_en || row.detail_ar
        ? localizedName({ name: row.detail_en ?? row.detail_ar ?? '', name_ar: row.detail_ar }, locale)
        : null
    const fullDate = row.due_on ? formatFullDate(row.due_on, locale) : ''
    const amount = row.amount !== null ? formatAmount(row.amount, locale) : null
    const startsAt = row.kind === 'appointment' ? startsAtById.get(row.subject_id) : undefined

    const bdi = (chunks: React.ReactNode) => <bdi>{chunks}</bdi>
    let message: string
    let about: React.ReactNode
    switch (row.kind) {
      case 'hearing':
        message = t('message.hearing', { client, firm, caseNumber: row.case_number ?? '', court: detail ?? '', date: fullDate })
        about = t.rich('about.hearing', { caseNumber: row.case_number ?? '', court: detail ?? '', bdi })
        break
      case 'appointment':
        message = startsAt
          ? t('message.appointment', { client, firm, date: fullDate, time: formatTime(startsAt, locale) })
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
      time: startsAt ? formatTime(startsAt, locale) : null,
      amount,
      lastReminded: row.last_reminded_at ? formatDateTime(row.last_reminded_at, locale) : null,
      recent,
      // null when there's no usable phone number - the row then explains
      // why it can't be reminded instead of offering a dead link.
      whatsappHref: whatsappLink(row.client_phone, message),
    }
  }

  const rows = candidates.map(prepare).filter((r): r is ReminderRow => r !== null)
  // Display grouping only: each kind keeps the order the queries produced
  // (everything due, then the recently reminded).
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
