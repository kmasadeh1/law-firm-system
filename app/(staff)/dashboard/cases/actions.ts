'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type ConflictMatch = {
  source: string
  matched_id: string
  matched_name: string
  case_id: string | null
}

type ActionResult = { error?: string }

function casePath(caseId: string) {
  return `/dashboard/cases/${caseId}`
}

// --- Client picker (create case) -----------------------------------------

export type ClientOption = { id: string; full_name: string; national_id: string | null }

export async function searchClients(term: string): Promise<ClientOption[]> {
  const trimmed = term.trim()
  if (!trimmed) return []

  const supabase = await createClient()
  const { data } = await supabase
    .rpc('search_clients', { p_query: trimmed })
    .select('id, full_name, national_id')
    .limit(10)

  return data ?? []
}

// --- Create case --------------------------------------------------------

export async function createCase(
  formData: FormData
): Promise<ActionResult & { caseId?: string }> {
  const client_id = formData.get('client_id')
  const title = formData.get('title')
  const case_number = formData.get('case_number')
  const case_type = formData.get('case_type')

  if (typeof client_id !== 'string' || !client_id) {
    return { error: 'Select a client.' }
  }
  if (typeof title !== 'string' || !title.trim()) {
    return { error: 'Title is required.' }
  }
  if (typeof case_number !== 'string' || !case_number.trim()) {
    return { error: 'Case number is required.' }
  }

  const supabase = await createClient()

  // Default status is the first non-terminal stage by sort_order - never a
  // status picker at creation time.
  const { data: firstStatus, error: statusError } = await supabase
    .from('case_statuses')
    .select('id')
    .eq('is_terminal', false)
    .order('sort_order')
    .limit(1)
    .single()

  if (statusError || !firstStatus) {
    return { error: 'Could not determine the starting status. Please try again.' }
  }

  const { data: user } = await supabase.auth.getClaims()

  const { data: inserted, error } = await supabase
    .from('cases')
    .insert({
      client_id,
      title: title.trim(),
      case_number: case_number.trim(),
      case_type: typeof case_type === 'string' && case_type.trim() ? case_type.trim() : null,
      status_id: firstStatus.id,
      created_by: user?.claims?.sub,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      return { error: 'That case number is already in use.' }
    }
    return { error: 'Could not create the case. Please try again.' }
  }

  revalidatePath('/dashboard/cases')
  return { caseId: inserted.id }
}

// --- Status --------------------------------------------------------------

export async function setCaseStatus(caseId: string, statusId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('cases')
    .update({ status_id: statusId })
    .eq('id', caseId)

  if (error) {
    // The close-permission trigger raises a plain exception whose message
    // is already the friendly text we want - just surface it.
    if (error.code === 'P0001') {
      return { error: error.message }
    }
    return { error: 'Could not update the status. Please try again.' }
  }

  revalidatePath(casePath(caseId))
  return {}
}

// --- Team ------------------------------------------------------------------

export async function addTeamMember(
  caseId: string,
  staffId: string,
  isLead: boolean
): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('case_lawyers')
    .insert({ case_id: caseId, staff_id: staffId, is_lead: isLead })

  if (error) {
    if (error.code === '23505' && error.message.includes('case_lawyers_one_lead')) {
      return {
        error:
          'This case already has a lead lawyer. Remove them as lead first, then promote someone else.',
      }
    }
    if (error.code === '23505') {
      return { error: 'That person is already on this case.' }
    }
    if (error.code === '42501') {
      return { error: "You don't have permission to change this case's team." }
    }
    return { error: 'Could not add them to the case. Please try again.' }
  }

  revalidatePath(casePath(caseId))
  return {}
}

export async function setTeamMemberLead(
  caseId: string,
  staffId: string,
  isLead: boolean
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('case_lawyers')
    .update({ is_lead: isLead })
    .eq('case_id', caseId)
    .eq('staff_id', staffId)
    .select('staff_id')

  if (error) {
    if (error.code === '23505' && error.message.includes('case_lawyers_one_lead')) {
      return {
        error:
          'This case already has a lead lawyer. Remove them as lead first, then promote someone else.',
      }
    }
    return { error: 'Could not update the team. Please try again.' }
  }

  // UPDATE blocked by RLS matches zero rows rather than erroring - treat
  // that the same as a denial rather than silently doing nothing.
  if (!data || data.length === 0) {
    return { error: "You don't have permission to change this case's team." }
  }

  revalidatePath(casePath(caseId))
  return {}
}

export async function removeTeamMember(caseId: string, staffId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('case_lawyers')
    .delete()
    .eq('case_id', caseId)
    .eq('staff_id', staffId)
    .select('staff_id')

  if (error) {
    return { error: 'Could not remove them from the case. Please try again.' }
  }

  if (!data || data.length === 0) {
    return { error: "You don't have permission to change this case's team, or they're already off it." }
  }

  revalidatePath(casePath(caseId))
  return {}
}

// --- Opposing parties ------------------------------------------------------

export async function addOpposingParty(
  caseId: string,
  formData: FormData,
  confirmed: boolean
): Promise<ActionResult & { matches?: ConflictMatch[] }> {
  const name = formData.get('name')
  const national_id = formData.get('national_id')

  if (typeof name !== 'string' || !name.trim()) {
    return { error: 'Name is required.' }
  }
  const trimmedName = name.trim()
  const trimmedNationalId =
    typeof national_id === 'string' && national_id.trim() ? national_id.trim() : null

  const supabase = await createClient()

  if (!confirmed) {
    const { data: matches, error: conflictError } = await supabase.rpc('check_conflict', {
      p_name: trimmedName,
      p_national_id: trimmedNationalId ?? undefined,
    })

    if (conflictError) {
      return { error: 'Could not run the conflict check. Please try again.' }
    }
    if (matches && matches.length > 0) {
      return { matches }
    }
  }

  const { error } = await supabase
    .from('case_opposing_parties')
    .insert({ case_id: caseId, name: trimmedName, national_id: trimmedNationalId })

  if (error) {
    return { error: 'Could not add the opposing party. Please try again.' }
  }

  revalidatePath(casePath(caseId))
  return {}
}
