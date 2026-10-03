'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

const TASKS_PATH = '/dashboard/tasks'

function casePath(caseId: string) {
  return `/dashboard/cases/${caseId}`
}

export type TaskStatus = 'open' | 'in_progress' | 'done' | 'cancelled'
export type TaskPriority = 'low' | 'normal' | 'high'

// Closed set the server can return - the render site validates against a
// whitelist before calling t(), same convention as every other *ErrorCode
// in this codebase. The two CHECKs are different mistakes and never share a
// slot. tasks_completed_matches_status should never actually fire through
// this UI (completed_at is never sent from here, only the trigger sets it)
// but is still mapped, same defensive habit as every other check mapping.
export type TaskErrorCode =
  | 'titleRequired'
  | 'titleBlank'
  | 'selectAssignee'
  | 'statusMismatch'
  | 'noPermissionAssign'
  | 'noPermissionUpdate'
  | 'addFailed'
  | 'updateFailed'

type ActionResult = { error?: TaskErrorCode }

function mapCheckViolation(message: string): TaskErrorCode | null {
  if (message.includes('tasks_title_not_blank')) return 'titleBlank'
  if (message.includes('tasks_completed_matches_status')) return 'statusMismatch'
  return null
}

// --- Case picker (optional, for the assign form) --------------------------

export type CaseOption = { id: string; case_number: string; title: string }

export async function searchCases(term: string): Promise<CaseOption[]> {
  const trimmed = term.trim()
  if (!trimmed) return []

  const supabase = await createClient()
  const safe = trimmed.replace(/[,()]/g, '')
  // No separate access check needed - RLS already scopes this to cases the
  // signed-in user can see.
  const { data } = await supabase
    .from('cases')
    .select('id, case_number, title')
    .or(`case_number.ilike.%${safe}%,title.ilike.%${safe}%`)
    .order('case_number')
    .limit(10)

  return data ?? []
}

// --- Create -----------------------------------------------------------------

export async function createTask(formData: FormData): Promise<ActionResult & { taskId?: string }> {
  const title = formData.get('title')
  const details = formData.get('details')
  const assigned_to = formData.get('assigned_to')
  const due_date = formData.get('due_date')
  const priority = formData.get('priority')
  const case_id = formData.get('case_id')

  if (typeof title !== 'string' || !title.trim()) {
    return { error: 'titleRequired' }
  }
  if (typeof assigned_to !== 'string' || !assigned_to) {
    return { error: 'selectAssignee' }
  }

  const supabase = await createClient()
  // created_by is never taken from the client - the insert RLS policy
  // requires it to equal the signed-in user, and a forged value is
  // rejected 42501. completed_at is never sent either - the
  // tasks_set_completed_at trigger owns it entirely.
  const { data: user } = await supabase.auth.getClaims()
  if (!user?.claims?.sub) {
    return { error: 'noPermissionAssign' }
  }

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      title: title.trim(),
      details: typeof details === 'string' && details.trim() ? details.trim() : null,
      assigned_to,
      due_date: typeof due_date === 'string' && due_date ? due_date : null,
      priority:
        typeof priority === 'string' && (['low', 'normal', 'high'] as string[]).includes(priority)
          ? (priority as TaskPriority)
          : undefined,
      case_id: typeof case_id === 'string' && case_id ? case_id : null,
      created_by: user.claims.sub as string,
    })
    .select('id, case_id')
    .single()

  if (error) {
    if (error.code === '23514') {
      return { error: mapCheckViolation(error.message) ?? 'addFailed' }
    }
    if (error.code === '42501') {
      return { error: 'noPermissionAssign' }
    }
    return { error: 'addFailed' }
  }

  revalidatePath(TASKS_PATH)
  if (data.case_id) revalidatePath(casePath(data.case_id))
  return { taskId: data.id }
}

// --- Status change -----------------------------------------------------------

// Marking a task done is a status change, nothing more - completed_at is
// never set here; tasks_set_completed_at stamps it when status becomes
// 'done' and clears it when status moves away, unconditionally.
export async function setTaskStatus(taskId: string, status: TaskStatus): Promise<ActionResult> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('tasks').update({ status }).eq('id', taskId).select('id, case_id')

  if (error) {
    if (error.code === '23514') {
      return { error: mapCheckViolation(error.message) ?? 'updateFailed' }
    }
    return { error: 'updateFailed' }
  }
  // UPDATE blocked by RLS matches zero rows rather than erroring - treat
  // that the same as a denial. In practice this shouldn't happen: the read
  // policy (owner/assignee/creator) and the update policy are the same
  // three conditions, so anyone who can see a task can also update it.
  if (!data || data.length === 0) {
    return { error: 'noPermissionUpdate' }
  }

  revalidatePath(TASKS_PATH)
  if (data[0].case_id) revalidatePath(casePath(data[0].case_id))
  return {}
}
