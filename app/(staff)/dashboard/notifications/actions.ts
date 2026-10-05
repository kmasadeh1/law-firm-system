'use server'

import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'
import { loadBellData, type BellData } from './data'

type AlertKind = Database['public']['Enums']['alert_kind']

// The bell's two sources are acted on by two different mechanisms, and
// these actions keep them apart:
//   stored notifications -> mark_notifications_read (there is no UPDATE
//                           grant on notifications; the function only
//                           touches the caller's own rows)
//   derived alerts       -> a row in alert_dismissals (an alert has no row
//                           of its own to mark)
// Every action returns the bell's fresh state, so the client never adjusts
// counts itself.

export type BellResult = { data: BellData; error?: 'update_failed' }

export async function refreshBell(): Promise<BellData> {
  return loadBellData()
}

// ids null marks every unread notification - "Mark all read". It never
// dismisses alerts: an approaching deadline must not vanish because
// someone cleared their notifications.
export async function markNotificationsRead(ids: string[] | null): Promise<BellResult> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('mark_notifications_read', ids ? { p_ids: ids } : {})
  const data = await loadBellData()
  return error ? { data, error: 'update_failed' } : { data }
}

export async function dismissAlert(kind: AlertKind, subjectId: string): Promise<BellResult> {
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  const staffId = claims?.claims?.sub
  if (!staffId) return { data: await loadBellData(), error: 'update_failed' }

  // staff_id is the signed-in user, never a client value - and the INSERT
  // policy refuses any other. Already dismissed (23505) is the outcome the
  // reader wanted, so it isn't reported as a failure.
  const { error } = await supabase
    .from('alert_dismissals')
    .insert({ staff_id: staffId, kind, subject_id: subjectId })
  const data = await loadBellData()
  return error && error.code !== '23505' ? { data, error: 'update_failed' } : { data }
}
