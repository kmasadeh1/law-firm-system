import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'

type NotificationType = Database['public']['Enums']['notification_type']
type AlertKind = Database['public']['Enums']['alert_kind']

// What the bell renders. Nothing here is prose: a notification is its type
// plus the names of what it points at, and the bell builds the sentence
// from the message files in the reader's language.
//
// subject is null when the reader can no longer see what the notification
// points at (RLS hides it, or it was deleted). The notification still
// shows - it happened - but without a link or a name.
export type BellNotification = {
  id: string
  type: NotificationType
  createdAt: string
  read: boolean
  actorName: string | null
  subject: { href: string; label: string | null; amount?: number | null } | null
}

export type BellAlert = {
  kind: AlertKind
  subjectId: string
  caseId: string | null
  caseNumber: string | null
  detailEn: string | null
  detailAr: string | null
  dueOn: string | null
  daysAway: number | null
}

export type BellData = {
  // Unread notifications plus undismissed alerts - the badge's number,
  // counted here so the bell only displays it.
  badgeCount: number
  unreadCount: number
  notifications: BellNotification[]
  alerts: BellAlert[]
}

// Every unread notification shows (up to a generous cap), then the most
// recent read ones, so the list keeps a little history without growing
// forever. Two queries, because "unread first, then newest" isn't an order
// PostgREST can express in one.
const UNREAD_LIMIT = 50
const READ_LIMIT = 10

const EMPTY: BellData = { badgeCount: 0, unreadCount: 0, notifications: [], alerts: [] }

const NOTIFICATION_COLUMNS = 'id, type, subject_table, subject_id, actor_id, created_at, read_at'

export async function loadBellData(): Promise<BellData> {
  const supabase = await createClient()

  // RLS returns only the reader's own notifications.
  const [{ data: unread, error }, { data: read }, { count: unreadCount }, { data: alertRows }] = await Promise.all([
    supabase
      .from('notifications')
      .select(NOTIFICATION_COLUMNS)
      .is('read_at', null)
      .order('created_at', { ascending: false })
      .limit(UNREAD_LIMIT),
    supabase
      .from('notifications')
      .select(NOTIFICATION_COLUMNS)
      .not('read_at', 'is', null)
      .order('created_at', { ascending: false })
      .limit(READ_LIMIT),
    supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null),
    // Already excludes what this reader dismissed and anything they can't
    // see (security_invoker). Most urgent first.
    supabase
      .from('pending_alerts')
      .select('kind, subject_id, case_id, case_number, due_on, days_away, detail_en, detail_ar')
      .order('days_away', { ascending: true })
      .order('due_on', { ascending: true }),
  ])

  if (error) return EMPTY

  const notifications = [...(unread ?? []), ...(read ?? [])]
  const idsFor = (table: string) =>
    notifications.filter((n) => n.subject_table === table).map((n) => n.subject_id)
  const actorIds = [...new Set(notifications.map((n) => n.actor_id).filter((id): id is string => !!id))]

  // One query per subject kind, only when there is something to look up.
  // Each is RLS-filtered: a subject the reader can't see simply isn't
  // returned, and the notification degrades to "no longer available".
  const caseIds = idsFor('cases')
  const taskIds = idsFor('tasks')
  const enquiryIds = idsFor('enquiries')
  const paymentIds = idsFor('payments')
  const staffIds = idsFor('staff')
  const none = Promise.resolve({ data: [] as never[] })

  const [cases, tasks, enquiries, payments, staffSubjects, actors] = await Promise.all([
    caseIds.length ? supabase.from('cases').select('id, case_number').in('id', caseIds) : none,
    taskIds.length ? supabase.from('tasks').select('id, title').in('id', taskIds) : none,
    enquiryIds.length ? supabase.from('enquiries').select('id, name').in('id', enquiryIds) : none,
    paymentIds.length
      ? supabase
          .from('payments')
          .select('id, amount, engagement_installments(engagement_id, engagements(clients(full_name)))')
          .in('id', paymentIds)
      : none,
    // Password-reset requests point at the person who asked.
    staffIds.length ? supabase.from('staff_directory').select('id, full_name').in('id', staffIds) : none,
    // Unfiltered by is_active - who assigned something should still show
    // after they leave the firm.
    actorIds.length ? supabase.from('staff_directory').select('id, full_name').in('id', actorIds) : none,
  ])

  const caseById = new Map((cases.data ?? []).map((c) => [c.id, c]))
  const taskById = new Map((tasks.data ?? []).map((t) => [t.id, t]))
  const enquiryById = new Map((enquiries.data ?? []).map((e) => [e.id, e]))
  const paymentById = new Map((payments.data ?? []).map((p) => [p.id, p]))
  const staffById = new Map((staffSubjects.data ?? []).map((m) => [m.id, m]))
  const actorById = new Map((actors.data ?? []).map((a) => [a.id, a.full_name]))

  function subjectFor(n: (typeof notifications)[number]): BellNotification['subject'] {
    switch (n.subject_table) {
      case 'cases': {
        const c = caseById.get(n.subject_id)
        return c ? { href: `/dashboard/cases/${c.id}`, label: c.case_number } : null
      }
      case 'tasks': {
        // No per-task page; the task list is where it's acted on.
        const t = taskById.get(n.subject_id)
        return t ? { href: '/dashboard/tasks', label: t.title } : null
      }
      case 'enquiries': {
        const e = enquiryById.get(n.subject_id)
        return e ? { href: `/dashboard/enquiries/${e.id}`, label: e.name } : null
      }
      case 'payments': {
        const p = paymentById.get(n.subject_id)
        if (!p) return null
        const installment = p.engagement_installments
        return {
          href: installment ? `/dashboard/fees/${installment.engagement_id}` : `/dashboard/fees/receipts/${p.id}`,
          label: installment?.engagements?.clients?.full_name ?? null,
          amount: p.amount,
        }
      }
      case 'staff': {
        // The Staff screen row carries id="staff-<id>", so the owner lands
        // on the person and can issue the password from there.
        const m = staffById.get(n.subject_id)
        return m ? { href: `/dashboard/owner/staff#staff-${m.id}`, label: m.full_name } : null
      }
      default:
        return null
    }
  }

  const alerts: BellAlert[] = (alertRows ?? [])
    .filter((a): a is typeof a & { kind: AlertKind; subject_id: string } => !!a.kind && !!a.subject_id)
    .map((a) => ({
      kind: a.kind,
      subjectId: a.subject_id,
      caseId: a.case_id,
      caseNumber: a.case_number,
      detailEn: a.detail_en,
      detailAr: a.detail_ar,
      dueOn: a.due_on,
      daysAway: a.days_away,
    }))

  return {
    badgeCount: (unreadCount ?? 0) + alerts.length,
    unreadCount: unreadCount ?? 0,
    notifications: notifications.map((n) => ({
      id: n.id,
      type: n.type,
      createdAt: n.created_at,
      read: n.read_at !== null,
      actorName: n.actor_id ? (actorById.get(n.actor_id) ?? null) : null,
      subject: subjectFor(n),
    })),
    alerts,
  }
}
