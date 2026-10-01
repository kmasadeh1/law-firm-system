'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { LeaveRequestErrorCode } from './error-codes'

type ActionResult = { error?: LeaveRequestErrorCode }

const LEAVE_REQUESTS_PATH = '/dashboard/leave-requests'
const CHECK_VIOLATION = '23514'
const INSUFFICIENT_PRIVILEGE = '42501'

function readDates(formData: FormData): { start_date: string; end_date: string } | { error: LeaveRequestErrorCode } {
  const startDate = formData.get('start_date')
  const endDate = formData.get('end_date')
  if (typeof startDate !== 'string' || !startDate) {
    return { error: 'startDateRequired' }
  }
  if (typeof endDate !== 'string' || !endDate) {
    return { error: 'endDateRequired' }
  }
  return { start_date: startDate, end_date: endDate }
}

export async function requestLeave(formData: FormData): Promise<ActionResult> {
  const fields = readDates(formData)
  if ('error' in fields) return fields

  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const user = data?.claims
  if (!user) {
    return { error: 'requestFailed' }
  }

  // staff_id and the two dates only - status defaults to 'pending', and
  // approved_by is set (to null) by the set_leave_approver trigger. Never
  // send either from the client.
  const { error } = await supabase.from('leave_requests').insert({
    staff_id: user.sub as string,
    ...fields,
  })

  if (error) {
    if (error.code === CHECK_VIOLATION) return { error: 'endBeforeStart' }
    if (error.code === INSUFFICIENT_PRIVILEGE) return { error: 'notPermitted' }
    return { error: 'requestFailed' }
  }

  revalidatePath(LEAVE_REQUESTS_PATH)
  return {}
}

// Owner-only in practice - the insert policy's WITH CHECK accepts
// status = 'approved' only when is_owner() is true; anyone else sending it
// is refused with 42501. There is nobody above the owner to approve his own
// leave, so this records it already-decided rather than routing through
// the pending/approve flow. approved_by is still never sent - the trigger
// sets it from auth.uid() because status isn't 'pending'.
export async function blockDaysOff(formData: FormData): Promise<ActionResult> {
  const fields = readDates(formData)
  if ('error' in fields) return fields

  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const user = data?.claims
  if (!user) {
    return { error: 'requestFailed' }
  }

  const { error } = await supabase.from('leave_requests').insert({
    staff_id: user.sub as string,
    status: 'approved',
    ...fields,
  })

  if (error) {
    if (error.code === CHECK_VIOLATION) return { error: 'endBeforeStart' }
    if (error.code === INSUFFICIENT_PRIVILEGE) return { error: 'notPermitted' }
    return { error: 'requestFailed' }
  }

  revalidatePath(LEAVE_REQUESTS_PATH)
  return {}
}

export async function withdrawLeaveRequest(requestId: string): Promise<ActionResult> {
  const supabase = await createClient()

  const { data, error } = await supabase.from('leave_requests').delete().eq('id', requestId).select('id')

  if (error) {
    return { error: 'withdrawFailed' }
  }
  if (!data || data.length === 0) {
    return { error: 'noPermissionWithdraw' }
  }

  revalidatePath(LEAVE_REQUESTS_PATH)
  return {}
}

export async function approveLeaveRequest(requestId: string): Promise<ActionResult> {
  return setLeaveRequestStatus(requestId, 'approved')
}

export async function rejectLeaveRequest(requestId: string): Promise<ActionResult> {
  return setLeaveRequestStatus(requestId, 'rejected')
}

// Owner-only in practice - the update policy for anyone else keeps status
// pending, so this affects zero rows for a non-owner. Status only;
// approved_by is set by the trigger, never sent from here.
async function setLeaveRequestStatus(
  requestId: string,
  status: 'approved' | 'rejected'
): Promise<ActionResult> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('leave_requests')
    .update({ status })
    .eq('id', requestId)
    .select('id')

  if (error) {
    return { error: 'decisionFailed' }
  }
  if (!data || data.length === 0) {
    return { error: 'noPermissionDecide' }
  }

  revalidatePath(LEAVE_REQUESTS_PATH)
  return {}
}
