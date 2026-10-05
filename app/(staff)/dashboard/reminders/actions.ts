'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { Constants, type Database } from '@/lib/supabase/database.types'

type ReminderKind = Database['public']['Enums']['reminder_kind']

export type ReminderErrorCode = 'noPermission' | 'recordFailed'

// "Mark as sent" - the person's own statement that the message left their
// phone. Opening WhatsApp records nothing, because the app can't know
// whether the message was sent. reminders_sent is append-only (no UPDATE or
// DELETE), so this is a permanent record of contact with the client.
// sent_by and sent_at are stamped by the reminders_sent_stamp trigger and
// never sent from here.
export async function markReminderSent(
  kind: ReminderKind,
  subjectId: string,
  clientId: string,
  sentToPhone: string
): Promise<{ error?: ReminderErrorCode }> {
  // Narrows the type only - the enum refuses anything else.
  if (!(Constants.public.Enums.reminder_kind as readonly string[]).includes(kind)) return { error: 'recordFailed' }

  const supabase = await createClient()
  // sent_by is NOT NULL with no column default, so the generated Insert type
  // requires it - but the BEFORE INSERT trigger sets it from the signed-in
  // user, overwriting anything sent. It is deliberately left out; the cast
  // records that the trigger, not this code, supplies it.
  const row = { kind, subject_id: subjectId, client_id: clientId, sent_to_phone: sentToPhone }
  const { error } = await supabase
    .from('reminders_sent')
    .insert(row as Database['public']['Tables']['reminders_sent']['Insert'])

  if (error) {
    // The INSERT policy is can_view_client(client_id).
    if (error.code === '42501') return { error: 'noPermission' }
    return { error: 'recordFailed' }
  }

  revalidatePath('/dashboard/reminders')
  return {}
}
